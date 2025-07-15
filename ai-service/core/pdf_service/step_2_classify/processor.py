"""
Step 2: Document Classification
Analyzes document content to determine document type and appropriate processing pipeline.

currently looks at the first 2000 characters for classification
"""

from typing import Dict, Any, List
from utils.logging import setup_logger
from datastore.document_datastore import document_datastore, DocumentStatus
import os

logger = setup_logger(__name__)

class ClassifyStep:
    """
    Step 2: Document Classification
    Uses LLM to analyze document content and classify document type for appropriate processing.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
        self.supported_document_types = {
            "contract": {
                "description": "Legal contracts, service agreements, employment contracts",
                "pipeline": ["analysis", "map", "interpret", "publish"],
                "focus_areas": ["obligations", "terms", "parties", "financial_arrangements", "compliance"]
            },
            "research_paper": {
                "description": "Academic papers, whitepapers, research studies",
                "pipeline": ["analysis", "extract", "summarize", "publish"],
                "focus_areas": ["methodology", "findings", "conclusions", "citations", "abstract"]
            },
            "legal_document": {
                "description": "Court filings, legal briefs, case law",
                "pipeline": ["analysis", "structure", "brief", "publish"],
                "focus_areas": ["legal_precedents", "arguments", "rulings", "citations", "case_facts"]
            },
            "technical_manual": {
                "description": "Documentation, user guides, specifications",
                "pipeline": ["analysis", "structure", "guide", "publish"],
                "focus_areas": ["procedures", "specifications", "requirements", "instructions", "troubleshooting"]
            },
            "business_report": {
                "description": "Financial reports, analytics, business analysis",
                "pipeline": ["analysis", "extract", "analyze", "publish"],
                "focus_areas": ["metrics", "analysis", "recommendations", "performance", "trends"]
            },
            "policy_document": {
                "description": "Company policies, regulations, compliance documents",
                "pipeline": ["analysis", "structure", "guide", "publish"],
                "focus_areas": ["rules", "compliance", "procedures", "requirements", "penalties"]
            }
        }
    
    async def process(self, pdf_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process PDF data to classify document type and determine processing pipeline.
        
        Args:
            pdf_data: Dictionary containing PDF segments and metadata
            
        Returns:
            Dictionary with document classification and pipeline configuration
        """
        logger.info(f"Starting document classification for PDF {pdf_data['pdf_id']}")
        
        segments = pdf_data.get('segments', [])
        
        if not segments:
            logger.warning("No segments found for classification")
            return self._create_fallback_classification(pdf_data['pdf_id'])
        
        # Extract sample content for classification
        sample_content = self._extract_sample_content(segments)
        
        # Classify document type
        document_type, confidence = await self._classify_document_type(sample_content)
        
        # Get pipeline configuration
        pipeline_config = self._get_pipeline_config(document_type)
        
        # Store classification results in datastore
        pdf_id = pdf_data['pdf_id']
        
        # Get existing document from datastore
        existing_doc = document_datastore.get_document(pdf_id)
        if existing_doc:
            # Update with classification results
            success = document_datastore.store_document(
                pdf_id=pdf_id,
                pages=existing_doc['pages'],
                status=DocumentStatus.CLASSIFIED,
                document_type=document_type,
                classification_confidence=confidence,
                classification_metadata={
                    'sample_content': sample_content,
                    'pipeline_config': pipeline_config,
                    'supported_types': list(self.supported_document_types.keys())
                }
            )
            
            if success:
                logger.info(f"Updated document {pdf_id} with classification: {document_type} (confidence: {confidence})")
            else:
                logger.warning(f"Failed to update document {pdf_id} with classification")
        else:
            logger.warning(f"Document {pdf_id} not found in datastore for classification update")
        
        logger.info(f"Document classified as '{document_type}' for PDF {pdf_id}")
        
        return {
            'pdf_id': pdf_id,
            'document_type': document_type,
            'classification_confidence': confidence,
            'pipeline_config': pipeline_config,
            'original_pdf_data': pdf_data,
            'sample_content': sample_content,
            'stored_in_datastore': success if existing_doc else False
        }
    
    def _extract_sample_content(self, segments: List) -> str:
        """Extract representative sample content for classification."""
        
        # Take first 10 segments for classification
        sample_segments = segments[:10]
        
        content_parts = []
        for segment in sample_segments:
            # Handle both dict format and object format
            if isinstance(segment, dict):
                content_parts.append(segment.get('content', ''))
            else:
                content_parts.append(segment.content)
        
        # Combine and limit to reasonable length
        full_content = " ".join(content_parts)
        
        # Limit to 2000 characters for classification
        return full_content[:2000] + "..." if len(full_content) > 2000 else full_content
    
    async def _classify_document_type(self, sample_content: str) -> tuple[str, float]:
        """Classify document type using LLM analysis."""
        
        if not self.openai_client:
            logger.warning("No OpenAI client available, using fallback classification")
            return "contract", 0.5  # Default fallback with moderate confidence
        
        # Load classification prompt
        classification_prompt = self._load_prompt_file('classification_prompt.txt')
        system_prompt = self._load_prompt_file('system_prompt.txt')
        
        # Build document types description
        types_description = self._build_document_types_description()
        
        prompt = classification_prompt.format(
            sample_content=sample_content,
            document_types=types_description
        )
        
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.1  # Low temperature for consistent classification
            )
            
            classified_type = response.choices[0].message.content.strip().lower()
            
            # Validate classification result
            if classified_type in self.supported_document_types:
                # TODO: Extract confidence from LLM response
                confidence = 0.8  # Default high confidence for valid classification
                return classified_type, confidence
            else:
                logger.warning(f"Unknown document type '{classified_type}', using fallback")
                return "contract", 0.3  # Default fallback with low confidence
                
        except Exception as e:
            logger.error(f"Document classification failed: {e}")
            return "contract", 0.1  # Default fallback with very low confidence
    
    def _build_document_types_description(self) -> str:
        """Build description of supported document types."""
        
        descriptions = []
        for doc_type, config in self.supported_document_types.items():
            descriptions.append(f"- {doc_type}: {config['description']}")
        
        return "\n".join(descriptions)
    
    def _get_pipeline_config(self, document_type: str) -> Dict[str, Any]:
        """Get pipeline configuration for document type."""
        
        if document_type not in self.supported_document_types:
            document_type = "contract"  # Default fallback
        
        config = self.supported_document_types[document_type]
        
        return {
            "document_type": document_type,
            "pipeline_steps": config["pipeline"],
            "focus_areas": config["focus_areas"],
            "description": config["description"]
        }
    
    def _create_fallback_classification(self, pdf_id: str) -> Dict[str, Any]:
        """Create fallback classification when no content is available."""
        
        return {
            'pdf_id': pdf_id,
            'document_type': 'contract',
            'classification_confidence': 0.1,
            'pipeline_config': self._get_pipeline_config('contract'),
            'original_pdf_data': {'pdf_id': pdf_id, 'segments': []},
            'sample_content': '',
            'stored_in_datastore': False
        }
    
    def _load_prompt_file(self, filename: str) -> str:
        """Load prompt from file."""
        
        current_dir = os.path.dirname(__file__)
        prompt_path = os.path.join(current_dir, filename)
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except FileNotFoundError:
            logger.warning(f"Prompt file not found: {filename}")
            return "Default prompt not available"
    
    def get_supported_document_types(self) -> Dict[str, Dict[str, Any]]:
        """Get all supported document types and their configurations."""
        return self.supported_document_types