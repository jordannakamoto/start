"""
PDF Service - Main service for processing PDF documents
Simple, direct processing with contract workflow support and future expansion stubs
"""

import hashlib
from typing import Dict, Any, List
from utils.logging import setup_logger
from core.workflow_manager import WorkflowManager
from flows.contracts.index import ContractIndex
from core.pdf_service.step_1_ingestion.processor import PDFIngestionStep
from core.pdf_service.step_2_classify.processor import ClassifyStep
from datastore.document_datastore import document_datastore, DocumentStatus

logger = setup_logger(__name__)

class PDFService:
    """
    Main service for PDF document processing.
    Handles: ingestion → classification → document-specific processing
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
        
        # Initialize workflow manager
        self.workflow_manager = WorkflowManager(openai_client)
        
        # Initialize processing steps
        self.ingestion_step = PDFIngestionStep()
        self.classify_step = ClassifyStep(openai_client)
        
        # Initialize document handlers
        self.document_handlers = {
            "contract": ContractIndex(openai_client),
            # Future document types can be added here:
            # "research_paper": ResearchPaperIndex(openai_client),
            # "legal_document": LegalDocumentIndex(openai_client),
        }
    
    async def ingest_pdf(self, pages: Dict[str, str]) -> Dict[str, Any]:
        """
        Process PDF ingestion - just ingests and returns job ID for later processing.
        
        Args:
            pages: Dictionary mapping page numbers to content
            
        Returns:
            Dictionary with job_id for tracking
        """
        try:
            # Process ingestion (this will generate the PDF ID)
            ingestion_result = await self.ingestion_step.process(pages)
            
            # Check if ingestion failed
            if ingestion_result.get("status") == "failed":
                return {
                    "job_id": ingestion_result.get("pdf_id", "error"),
                    "status": "failed",
                    "error": ingestion_result.get("error", "Unknown ingestion error")
                }
            
            return {
                "job_id": ingestion_result["pdf_id"],
                "status": "ingested",
                "message": "PDF ingested successfully. Use /assistant-message to process.",
                "stored_in_datastore": ingestion_result.get("stored_in_datastore", False)
            }
            
        except Exception as e:
            logger.error(f"PDF ingestion failed: {str(e)}")
            return {
                "job_id": f"error_{hash(str(pages))[:8]}",
                "status": "failed",
                "error": str(e)
            }
    
    async def process_pdf_summary(self, pdf_id: str) -> Dict[str, Any]:
        """
        Process PDF summary through: classification → document-specific workflow
        
        Args:
            pdf_id: ID of the PDF to summarize
            
        Returns:
            Dictionary with structured summary and citations
        """
        logger.info(f"Retrieving PDF data for summarization with ID: {pdf_id}")
        try:
            # Step 1: Get PDF data
            pdf_data = await self._get_pdf_data(pdf_id)
            
            # Step 2: Classify document type
            classification_result = await self.classify_step.process(pdf_data)
            logger.info(f"Classifying document type: {classification_result}")
            document_type = classification_result.get('document_type', 'contract')
            
            # Step 3: Route to appropriate document handler via workflow manager
            if document_type in self.document_handlers:
                handler = self.document_handlers[document_type]
                # Use workflow manager to execute the handler's workflow with status tracking
                result = await self.workflow_manager.execute_simple_workflow(
                    lambda data: handler.process_contract(data, "summarize"),
                    pdf_data,
                    workflow_id=pdf_id
                )
                result = result.get('result', result)
            else:
                # Fallback to contract handler
                logger.warning(f"Unknown document type '{document_type}', using contract handler")
                handler = self.document_handlers["contract"]
                result = await self.workflow_manager.execute_simple_workflow(
                    lambda data: handler.process_contract(data, "summarize"),
                    pdf_data,
                    workflow_id=pdf_id
                )
                result = result.get('result', result)
            
            # Add metadata
            result['pdf_id'] = pdf_id
            result['document_type'] = document_type
            
            return result
            
        except Exception as e:
            logger.error(f"PDF summary processing failed: {str(e)}")
            return {
                "response": f"I encountered an error while summarizing the PDF: {str(e)}",
                "citations": [],
                "has_citations": False,
                "error": str(e),
                "pdf_id": pdf_id,
                "document_type": "unknown"
            }
    
    async def process_assistant_message(self, message: str, user_id: str = None) -> Dict[str, Any]:
        """
        Process assistant message requests.
        
        Args:
            message: User message to process
            user_id: User ID for tracking (optional)
            
        Returns:
            Dictionary with AI response
        """
        try:
            # Check if this is a PDF summarization request
            if message.startswith("summarize_pdf:"):
                pdf_id = message.split(":", 1)[1]
                logger.info(f"Processing PDF summarization request for PDF ID: {pdf_id}")
                return await self.process_pdf_summary(pdf_id)
            
            # Simple message processing - just echo for now
            return {
                "response": f"I received your message: {message}",
                "citations": [],
                "has_citations": False
            }
            
        except Exception as e:
            logger.error(f"Assistant message processing failed: {str(e)}")
            return {
                "response": f"I encountered an error: {str(e)}",
                "citations": [],
                "has_citations": False,
                "error": str(e)
            }
    
    async def _get_pdf_data(self, pdf_id: str) -> Dict[str, Any]:
        """Get PDF data for processing from datastore."""
        try:
            # First try to get from datastore
            document = document_datastore.get_document(pdf_id)
            if document:
                logger.info(f"Retrieved document {pdf_id} from datastore")
                return {
                    "pdf_id": pdf_id,
                    "pages": document["pages"],
                    "segments": self._convert_pages_to_segments(document["pages"]),
                    "document_type": document.get("document_type"),
                    "classification_confidence": document.get("classification_confidence"),
                    "status": document.get("status")
                }
            else:
                logger.warning(f"Document {pdf_id} not found in datastore")
                # Fallback to search service
                from services.search_service import SearchService
                search_service = SearchService()
                return await search_service.get_pdf_data(pdf_id)
        except Exception as e:
            logger.warning(f"Could not get PDF data from datastore: {e}")
            return {"pdf_id": pdf_id, "segments": []}
    
    def _convert_pages_to_segments(self, pages: Dict[str, str]) -> List[Dict[str, Any]]:
        """Convert page content to segments format for compatibility."""
        segments = []
        for page_num, content in pages.items():
            # Simple segmentation by sentences
            sentences = content.split('. ')
            for i, sentence in enumerate(sentences):
                if sentence.strip():
                    # Create reference string directly instead of lambda
                    reference = f"p{page_num}.para1.s{i+1}"
                    segments.append({
                        "content": sentence.strip() + '.' if not sentence.endswith('.') else sentence.strip(),
                        "page": int(page_num) if isinstance(page_num, str) and page_num.isdigit() else page_num,
                        "paragraph": 1,
                        "sentence": i + 1,
                        "char_start": 0,
                        "char_end": len(sentence),
                        "reference": reference
                    })
        return segments
    
    def get_supported_document_types(self) -> Dict[str, str]:
        """Get list of supported document types."""
        return {
            "contract": "Legal contracts and service agreements",
            # Future types:
            # "research_paper": "Academic papers and research documents",
            # "legal_document": "Legal briefs and court documents",
        }
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get system information."""
        return {
            "service": "PDF Processing Service",
            "supported_document_types": self.get_supported_document_types(),
            "processing_flow": [
                "1. Ingestion - Extract and store PDF content",
                "2. Classification - Determine document type",
                "3. Processing - Route to appropriate workflow"
            ],
            "default_workflow": "contract"
        }