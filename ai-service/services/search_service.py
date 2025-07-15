"""
Search Service
Handles PDF search indexing and retrieval operations.
"""

from typing import Dict, Any, List
from frontend_api.search_api import search_store
from datastore.search_datastore import SearchDataStore
from utils.logging import setup_logger

logger = setup_logger(__name__)

class SearchService:
    """
    Service for managing PDF search operations and indexing.
    """
    
    def __init__(self):
        self.search_store = search_store
    
    async def get_pdf_data(self, pdf_id: str) -> Dict[str, Any]:
        """
        Retrieve PDF data from the search store.
        
        Args:
            pdf_id: ID of the PDF to retrieve
            
        Returns:
            Dictionary with PDF data and segments
        """
        logger.info(f"Retrieving PDF data for {pdf_id}")
        
        if pdf_id not in self.search_store.pdf_caches:
            raise ValueError(f"PDF {pdf_id} not found in search index")
        
        cache = self.search_store.pdf_caches[pdf_id]
        all_segments = list(cache.semantic_index.segments.values())
        
        logger.info(f"Retrieved {len(all_segments)} segments for PDF {pdf_id}")
        
        return {
            'pdf_id': pdf_id,
            'segments': all_segments,
            'cache': cache
        }
    
    async def check_pdf_exists(self, pdf_id: str) -> bool:
        """
        Check if a PDF exists in the search index.
        
        Args:
            pdf_id: ID of the PDF to check
            
        Returns:
            True if PDF exists, False otherwise
        """
        return pdf_id in self.search_store.pdf_caches
    
    async def get_segment_count(self, pdf_id: str) -> int:
        """
        Get the number of segments for a PDF.
        
        Args:
            pdf_id: ID of the PDF
            
        Returns:
            Number of segments
        """
        if pdf_id not in self.search_store.pdf_caches:
            return 0
        
        cache = self.search_store.pdf_caches[pdf_id]
        return len(cache.semantic_index.segments)
    
    async def search_segments(self, pdf_id: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for segments matching a query.
        
        Args:
            pdf_id: ID of the PDF to search
            query: Search query
            limit: Maximum number of results
            
        Returns:
            List of matching segments
        """
        logger.info(f"Searching segments for PDF {pdf_id} with query: {query}")
        
        if pdf_id not in self.search_store.pdf_caches:
            return []
        
        cache = self.search_store.pdf_caches[pdf_id]
        matching_segments = []
        
        for segment in cache.semantic_index.segments.values():
            # Handle both dict format and object format
            if hasattr(segment, 'content'):
                content = segment.content
                reference = segment.get_reference()
                page = segment.page
                paragraph = segment.paragraph
                sentence = segment.sentence
                char_range = [segment.char_start, segment.char_end]
            else:
                content = segment.get('content', '')
                reference = segment.get('reference', '')
                page = segment.get('page', 1)
                paragraph = segment.get('paragraph', 1)
                sentence = segment.get('sentence', 1)
                char_range = [segment.get('char_start', 0), segment.get('char_end', 0)]
            
            if query.lower() in content.lower():
                matching_segments.append({
                    'content': content,
                    'reference': reference,
                    'page': page,
                    'paragraph': paragraph,
                    'sentence': sentence,
                    'char_range': char_range
                })
                
                if len(matching_segments) >= limit:
                    break
        
        logger.info(f"Found {len(matching_segments)} matching segments")
        return matching_segments