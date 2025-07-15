"""
Standalone Citation Service
Handles all citation-related operations including extraction, validation, and resolution.
"""

import re
from typing import Dict, Any, List
from frontend_api.search_api import search_store
from utils.logging import setup_logger

logger = setup_logger(__name__)

class CitationService:
    """
    Standalone service for managing citations throughout the PDF processing workflow.
    """
    
    def __init__(self):
        self.search_store = search_store
        self.citation_pattern = r'\[p\d+\.para\d+\.s\d+\]'
    
    async def extract_citations(self, text: str) -> List[str]:
        """
        Extract citations from text using standard pattern.
        
        Args:
            text: Text containing citations
            
        Returns:
            List of citation strings
        """
        citations = re.findall(self.citation_pattern, text)
        logger.info(f"Extracted {len(citations)} citations from text")
        return citations
    
    async def resolve_citation(self, pdf_id: str, citation: str) -> Dict[str, Any]:
        """
        Resolve a citation reference to PDF content and coordinate information.
        
        Args:
            pdf_id: PDF identifier
            citation: Citation reference to resolve
            
        Returns:
            Dictionary with citation details
        """
        logger.info(f"Resolving citation {citation} for PDF {pdf_id}")
        
        try:
            # Clean citation format (remove brackets if present)
            clean_citation = citation.strip('[]')
            
            # Search directly in the search store for the citation reference
            if pdf_id not in self.search_store.pdf_caches:
                return {
                    "citation": citation,
                    "found": False,
                    "error": "PDF not found in search index"
                }
            
            cache = self.search_store.pdf_caches[pdf_id]
            
            # Look for segment with matching reference
            for segment in cache.semantic_index.segments.values():
                # Handle both dict format and object format
                if hasattr(segment, 'get_reference'):
                    segment_reference = segment.get_reference()
                else:
                    segment_reference = segment.get('reference', '')
                
                if segment_reference == clean_citation:
                    # Handle both dict format and object format for content access
                    if hasattr(segment, 'content'):
                        content = segment.content
                        page = segment.page
                        paragraph = segment.paragraph
                        sentence = segment.sentence
                        char_range = [segment.char_start, segment.char_end]
                    else:
                        content = segment.get('content', '')
                        page = segment.get('page', 1)
                        paragraph = segment.get('paragraph', 1)
                        sentence = segment.get('sentence', 1)
                        char_range = [segment.get('char_start', 0), segment.get('char_end', 0)]
                    
                    return {
                        "citation": citation,
                        "found": True,
                        "content": content,
                        "page": page,
                        "paragraph": paragraph,
                        "sentence": sentence,
                        "char_range": char_range,
                        "context": {}
                    }
            
            return {
                "citation": citation,
                "found": False,
                "error": "Citation reference not found"
            }
            
        except Exception as e:
            logger.error(f"Citation resolution failed: {str(e)}")
            return {
                "citation": citation,
                "found": False,
                "error": str(e)
            }
    
    async def validate_citations(self, citations: List[str]) -> Dict[str, Any]:
        """
        Validate citation format and integrity.
        
        Args:
            citations: List of citation strings to validate
            
        Returns:
            Dictionary with validation results
        """
        logger.info(f"Validating {len(citations)} citations")
        
        citation_pattern = r'p\d+\.para\d+\.s\d+'
        
        invalid_citations = []
        for citation in citations:
            clean_citation = citation.strip('[]')
            if not re.match(citation_pattern, clean_citation):
                invalid_citations.append(citation)
        
        if invalid_citations:
            return {
                "valid": False,
                "error": f"Invalid citation format: {invalid_citations}",
                "valid_count": len(citations) - len(invalid_citations),
                "invalid_count": len(invalid_citations)
            }
        
        return {
            "valid": True,
            "valid_count": len(citations),
            "invalid_count": 0
        }
    
    def format_reference(self, page: int, paragraph: int, sentence: int) -> str:
        """
        Format a reference in standard citation format.
        
        Args:
            page: Page number
            paragraph: Paragraph number
            sentence: Sentence number
            
        Returns:
            Formatted reference string
        """
        return f"p{page}.para{paragraph}.s{sentence}"
    
    def parse_bullet_points_with_citations(self, summary_text: str) -> List[Dict[str, Any]]:
        """
        Parse the summary into structured sections with bullet points and their citations.
        Returns a list of sections, each with title and clickable bullet points.
        """
        logger.info("Parsing bullet points with citations")
        
        sections = []
        
        # Split by numbered headings
        section_splits = re.split(r'\n(\d+\.\s[^\n]+)', summary_text)
        
        # Skip intro, process sections
        for i in range(1, len(section_splits), 2):
            if i + 1 < len(section_splits):
                title = section_splits[i].strip()
                content = section_splits[i + 1].strip()
                
                # Extract bullet points
                bullet_lines = [line.strip() for line in content.split('\n') if line.strip().startswith('-')]
                
                bullets = []
                for bullet in bullet_lines:
                    # Extract citations from this bullet
                    bullet_citations = re.findall(self.citation_pattern, bullet)
                    
                    # Remove citations from display text
                    clean_text = re.sub(self.citation_pattern, '', bullet).strip()
                    # Remove leading dash and clean up
                    clean_text = re.sub(r'^-\s*', '', clean_text).strip()
                    
                    bullets.append({
                        "text": clean_text,
                        "citations": bullet_citations
                    })
                
                if bullets:  # Only add sections with bullet points
                    sections.append({
                        "title": title,
                        "bullets": bullets
                    })
        
        logger.info(f"Parsed {len(sections)} sections with bullet points")
        return sections
    
    def clean_citation_text(self, text: str) -> str:
        """
        Remove citation references from text for display purposes.
        
        Args:
            text: Text containing citations
            
        Returns:
            Clean text without citations
        """
        return re.sub(self.citation_pattern, '', text).strip()
    
    def get_citation_count(self, text: str) -> int:
        """
        Count the number of citations in text.
        
        Args:
            text: Text to count citations in
            
        Returns:
            Number of citations found
        """
        return len(re.findall(self.citation_pattern, text))