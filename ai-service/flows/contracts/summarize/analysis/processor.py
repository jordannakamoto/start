"""
Step 2: Deterministic Analysis
Handles structured analysis of PDF content to extract claims, entities, and relationships.
"""

from typing import Dict, Any, List
from flows.contracts.summarize.analysis.deterministic_analysis import DeterministicAnalysisEngine
from utils.logging import setup_logger

logger = setup_logger(__name__)

class AnalysisStep:
    """
    Step 2: Deterministic Analysis
    Extracts structured claims, entities, and relationships from PDF segments.
    """
    
    def __init__(self):
        self.analysis_engine = DeterministicAnalysisEngine()
    
    async def process(self, pdf_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process PDF data through deterministic analysis.
        
        Args:
            pdf_data: Dictionary containing PDF segments and metadata
            
        Returns:
            Dictionary with analysis results
        """
        logger.info(f"Starting deterministic analysis for PDF {pdf_data['pdf_id']}")
        
        segments = pdf_data.get('segments', [])
        
        if not segments:
            logger.warning("No segments found for analysis")
            return {
                'pdf_id': pdf_data['pdf_id'],
                'validated_claims': [],
                'knowledge_graph': None,
                'analysis_metadata': {
                    'total_claims': 0,
                    'entities_found': 0,
                    'relationships_found': 0,
                    'claim_types': []
                }
            }
        
        # Convert segments to the format expected by the analysis engine
        key_results = []
        for segment in segments:
            # Handle both dict format and object format
            if isinstance(segment, dict):
                key_results.append({
                    'segment': {
                        'content': segment.get('content', ''),
                        'reference': segment.get('reference', ''),
                        'page': segment.get('page', 1),
                        'paragraph': segment.get('paragraph', 1),
                        'sentence': segment.get('sentence', 1),
                        'char_range': [segment.get('char_start', 0), segment.get('char_end', 0)]
                    }
                })
            else:
                key_results.append({
                    'segment': {
                        'content': segment.content,
                        'reference': segment.get_reference(),
                        'page': segment.page,
                        'paragraph': segment.paragraph,
                        'sentence': segment.sentence,
                        'char_range': [segment.char_start, segment.char_end]
                    }
                })
        
        # Run deterministic analysis
        analysis_result = self.analysis_engine.analyze_document(key_results)
        
        # Log analysis metadata
        metadata = analysis_result['analysis_metadata']
        logger.info(f"Analysis completed: {metadata['total_claims']} claims, {metadata['entities_found']} entities")
        logger.info(f"Claim types: {', '.join(metadata['claim_types'])}")
        
        return {
            'pdf_id': pdf_data['pdf_id'],
            'original_segments': segments,
            'validated_claims': analysis_result['validated_claims'],
            'knowledge_graph': analysis_result['knowledge_graph'],
            'analysis_metadata': metadata,
            'structured_summary': analysis_result.get('structured_summary', '')
        }