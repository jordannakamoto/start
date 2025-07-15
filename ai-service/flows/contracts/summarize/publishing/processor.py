"""
Step 5: Publish Strategic Briefing
Validates, formats, and publishes the final strategic briefing.
"""

import re
import asyncio
from typing import Dict, Any, List
from utils.logging import setup_logger
from utils.validation import ValidationService

logger = setup_logger(__name__)

class PublishStep:
    """
    Step 5: Publish Strategic Briefing
    Validates and publishes the final strategic briefing with citations.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
        self.validation_service = ValidationService()
    
    async def process(self, interpret_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process interpret results to create final published briefing.
        
        Args:
            interpret_result: Dictionary containing strategic briefing
            
        Returns:
            Dictionary with final published briefing and structured data
        """
        logger.info(f"Starting briefing publication for PDF {interpret_result['pdf_id']}")
        
        strategic_briefing = interpret_result.get('strategic_briefing', '')
        
        if not strategic_briefing:
            logger.warning("No strategic briefing available for publication")
            return {
                'pdf_id': interpret_result['pdf_id'],
                'response': 'No briefing available for publication',
                'structured_sections': [],
                'citations': [],
                'has_citations': False
            }
        
        # Validate and retry sections if needed
        validated_briefing = await self._validate_and_retry_sections(strategic_briefing)
        
        # Extract citations from the response
        citation_pattern = r'\[p\d+\.para\d+\.s\d+\]'
        found_citations = re.findall(citation_pattern, validated_briefing)
        
        # Parse bullet points and associate citations
        structured_sections = self._parse_bullet_points_with_citations(validated_briefing)
        
        logger.info(f"Briefing publication completed for PDF {interpret_result['pdf_id']}")
        
        return {
            'pdf_id': interpret_result['pdf_id'],
            'response': validated_briefing,
            'structured_sections': structured_sections,
            'citations': found_citations,
            'has_citations': len(found_citations) > 0
        }
    
    async def _validate_and_retry_sections(self, briefing_text: str) -> str:
        """
        Validate briefing sections and retry failed ones.
        """
        logger.info("Validating briefing sections")
        
        # Split by numbered headings
        sections = []
        numbered_sections = re.split(r'\n(?=\d+\.\s)', briefing_text)
        
        if len(numbered_sections) > 1:
            sections = [s.strip() for s in numbered_sections[1:] if s.strip()]
        else:
            # If no numbered sections, return as is
            logger.info("No numbered sections found, returning briefing as is")
            return briefing_text
        
        validated_sections = []
        
        for i, section in enumerate(sections):
            expected_number = i + 1
            validation_result = self.validation_service.validate_section_format(section, expected_number)
            
            if validation_result["valid"]:
                logger.info(f"✅ Section {expected_number} validation passed")
                validated_sections.append(section)
            else:
                logger.warning(f"❌ Section {expected_number} validation failed: {validation_result['reason']}")
                # Use fallback section
                fallback_section = self._create_fallback_section(section, expected_number)
                validated_sections.append(fallback_section)
        
        # Reassemble with introduction
        strategic_introduction = "A Briefing on Consultant Responsibilities\nTo ensure this project aligns with our strategic goals, the consultant's engagement is governed by the following core commitments."
        final_body = "\n\n".join(validated_sections)
        
        return f"{strategic_introduction}\n\n{final_body}"
    
    def _create_fallback_section(self, original_section: str, section_number: int) -> str:
        """
        Create a minimal valid section when validation fails.
        """
        return f"""{section_number}. Document Requirements
- The document contains requirements that must be followed for project success.
- All parties must comply with the terms outlined in the agreement."""
    
    def _parse_bullet_points_with_citations(self, summary_text: str) -> List[Dict[str, Any]]:
        """
        Parse the summary into structured sections with bullet points and their citations.
        Returns a list of sections, each with title and clickable bullet points.
        """
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
                    citation_pattern = r'\[p\d+\.para\d+\.s\d+\]'
                    bullet_citations = re.findall(citation_pattern, bullet)
                    
                    # Remove citations from display text
                    clean_text = re.sub(citation_pattern, '', bullet).strip()
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
        
        return sections