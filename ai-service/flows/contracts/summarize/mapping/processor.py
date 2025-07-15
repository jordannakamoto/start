"""
Step 3: Map Analysis Results
Maps deterministic analysis results into user-friendly navigation summaries.
"""

from typing import Dict, Any, List
from utils.logging import setup_logger

logger = setup_logger(__name__)

class MapStep:
    """
    Step 3: Map Analysis Results
    Maps deterministic analysis into structured navigation summaries.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
    
    async def process(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process analysis results to create navigation summary.
        
        Args:
            analysis_result: Dictionary containing deterministic analysis results
            
        Returns:
            Dictionary with navigation summary
        """
        logger.info(f"Starting navigation mapping for PDF {analysis_result['pdf_id']}")
        
        if not self.openai_client:
            logger.warning("No OpenAI client available, using structured summary fallback")
            return {
                'pdf_id': analysis_result['pdf_id'],
                'navigation_summary': analysis_result.get('structured_summary', 'No summary available'),
                'analysis_result': analysis_result
            }
        
        # Extract structured data
        knowledge_graph = analysis_result['knowledge_graph']
        validated_claims = analysis_result['validated_claims']
        metadata = analysis_result['analysis_metadata']
        
        # Build context from original segments
        context_segments = []
        for segment in analysis_result['original_segments']:
            # Handle both dict format and object format
            if hasattr(segment, 'get_reference'):
                reference = segment.get_reference()
                content = segment.content
            else:
                reference = segment.get('reference', '')
                content = segment.get('content', '')
            
            context_segments.append(f"[{reference}]: {content}")
        
        context_text = "\n".join(context_segments)
        
        # Build prompt with structured foundation
        structured_data_prompt = self._build_structured_data_prompt(
            validated_claims, knowledge_graph, metadata
        )
        
        # Generate navigation summary
        navigation_summary = await self._generate_navigation_summary(
            structured_data_prompt, context_text
        )
        
        logger.info(f"Navigation mapping completed for PDF {analysis_result['pdf_id']}")
        
        return {
            'pdf_id': analysis_result['pdf_id'],
            'navigation_summary': navigation_summary,
            'analysis_result': analysis_result,
            'context_text': context_text[:1500] + "..." if len(context_text) > 1500 else context_text
        }
    
    def _build_structured_data_prompt(self, claims: List, knowledge_graph, metadata: Dict) -> str:
        """Build prompt section with structured deterministic data."""
        
        prompt_parts = [
            f"ANALYSIS METADATA:",
            f"- Total validated claims: {metadata['total_claims']}",
            f"- Claim types found: {', '.join(metadata['claim_types'])}",
            f"- Entities identified: {metadata['entities_found']}",
            f"- Relationships mapped: {metadata['relationships_found']}",
            "",
            "VALIDATED CLAIMS (with citations):"
        ]
        
        # Group claims by type for better organization
        claims_by_type = {}
        for claim in claims:
            claim_type = claim.claim_type
            if claim_type not in claims_by_type:
                claims_by_type[claim_type] = []
            claims_by_type[claim_type].append(claim)
        
        for claim_type, type_claims in claims_by_type.items():
            prompt_parts.append(f"\n{claim_type.upper()} CLAIMS:")
            for claim in type_claims:
                citations_str = ", ".join(f"[{cit}]" for cit in claim.citations)
                prompt_parts.append(f"  - {claim.subject} {claim.predicate} {claim.object or ''} {citations_str}")
                if claim.conditions:
                    prompt_parts.append(f"    Conditions: {'; '.join(claim.conditions)}")
                if claim.temporal_scope:
                    prompt_parts.append(f"    Timeline: {claim.temporal_scope}")
        
        # Add key entities
        if knowledge_graph and knowledge_graph.entities:
            prompt_parts.append("\nKEY ENTITIES:")
            for entity_id, entity_data in list(knowledge_graph.entities.items())[:10]:
                citation = entity_data.get('citation', 'unknown')
                prompt_parts.append(f"  - {entity_data['text']} ({entity_data.get('label', 'ENTITY')}) [{citation}]")
        
        return "\n".join(prompt_parts)
    
    async def _generate_navigation_summary(self, structured_data_prompt: str, context_text: str) -> str:
        """Generate user-friendly navigation summary using deterministic analysis as foundation."""
        
        # Load prompt from file
        prompt_template = self._load_prompt_file('navigation_summary_prompt.txt')
        system_prompt = self._load_prompt_file('system_prompt.txt')
        
        prompt = prompt_template.format(
            structured_data_prompt=structured_data_prompt,
            context_text=context_text[:1500] + "..." if len(context_text) > 1500 else context_text
        )

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.2
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Navigation summary generation failed: {e}")
            # Fallback to structured summary
            return structured_data_prompt
    
    def _load_prompt_file(self, filename: str) -> str:
        """Load prompt from file."""
        import os
        
        current_dir = os.path.dirname(__file__)
        prompt_path = os.path.join(current_dir, filename)
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except FileNotFoundError:
            logger.warning(f"Prompt file not found: {filename}")
            return "Default prompt not available"