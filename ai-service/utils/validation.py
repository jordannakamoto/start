"""
Validation utilities for input/output validation.
"""

import re
from typing import Dict, Any, List

class ValidationService:
    """
    Service for validating inputs and outputs throughout the workflow.
    """
    
    def validate_pdf_pages(self, pages: Dict[str, str]) -> Dict[str, Any]:
        """
        Validate PDF pages input.
        
        Args:
            pages: Dictionary mapping page numbers to content
            
        Returns:
            Validation result with status and errors
        """
        if not pages:
            return {"valid": False, "error": "No pages provided"}
        
        if not isinstance(pages, dict):
            return {"valid": False, "error": "Pages must be a dictionary"}
        
        total_chars = sum(len(content) for content in pages.values())
        if total_chars < 10:
            return {"valid": False, "error": "Insufficient content"}
        
        return {"valid": True}
    
    def validate_section_format(self, section_text: str, expected_number: int) -> Dict[str, Any]:
        """
        Validate that a section has proper format.
        
        Args:
            section_text: Section text to validate
            expected_number: Expected section number
            
        Returns:
            Validation result with status and reason
        """
        lines = section_text.strip().split('\n')
        
        if not lines:
            return {"valid": False, "reason": "Empty section"}
        
        first_line = lines[0].strip()
        expected_start = f"{expected_number}."
        
        if not first_line.startswith(expected_start):
            return {
                "valid": False, 
                "reason": f"Missing or incorrect section number. Expected '{expected_start}', got '{first_line[:20]}...'"
            }
        
        # Check for bullet points
        bullet_lines = [line.strip() for line in lines[1:] if line.strip().startswith('-')]
        
        if len(bullet_lines) == 0:
            return {"valid": False, "reason": "No bullet points found"}
        
        # Check bullet format
        for bullet in bullet_lines:
            if not bullet.startswith('- '):
                return {"valid": False, "reason": f"Improperly formatted bullet: '{bullet[:30]}...'"}
            
            # Check minimum content length
            content = bullet[2:].strip()
            if len(content) < 10:
                return {"valid": False, "reason": f"Bullet too short: '{content}'"}
        
        return {"valid": True, "reason": "Section format is valid"}
    
    def validate_citations(self, citations: List[str]) -> Dict[str, Any]:
        """
        Validate citation format.
        
        Args:
            citations: List of citation strings
            
        Returns:
            Validation result
        """
        citation_pattern = r'p\d+\.para\d+\.s\d+'
        
        invalid_citations = []
        for citation in citations:
            clean_citation = citation.strip('[]')
            if not re.match(citation_pattern, clean_citation):
                invalid_citations.append(citation)
        
        if invalid_citations:
            return {
                "valid": False,
                "error": f"Invalid citation format: {invalid_citations}"
            }
        
        return {"valid": True}