"""
Step 4: Interpret Navigation Summary
Interprets navigation summaries into strategic executive briefings.
"""

import re
import asyncio
from typing import Dict, Any, List
from utils.logging import setup_logger

logger = setup_logger(__name__)

class InterpretStep:
    """
    Step 4: Interpret Navigation Summary
    Interprets navigation summaries into executive briefings with strategic tone.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
    
    async def process(self, map_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process interpretation results to create strategic briefing.
        
        Args:
            interpret_result: Dictionary containing navigation summary
            
        Returns:
            Dictionary with strategic briefing
        """
        logger.info(f"Starting strategic briefing creation for PDF {map_result['pdf_id']}")
        
        if not self.openai_client:
            logger.warning("No OpenAI client available, using navigation summary as briefing")
            return {
                'pdf_id': map_result['pdf_id'],
                'strategic_briefing': map_result.get('navigation_summary', 'No briefing available'),
                'original_summary': map_result.get('navigation_summary', '')
            }
        
        navigation_summary = map_result.get('navigation_summary', '')
        
        if not navigation_summary:
            logger.warning("No navigation summary available for briefing creation")
            return {
                'pdf_id': map_result['pdf_id'],
                'strategic_briefing': 'No content available for briefing creation',
                'original_summary': ''
            }
        
        # Transform to strategic briefing
        strategic_briefing = await self._rewrite_summary_to_strategic_briefing(navigation_summary)
        
        logger.info(f"Strategic briefing created for PDF {map_result['pdf_id']}")
        
        return {
            'pdf_id': map_result['pdf_id'],
            'strategic_briefing': strategic_briefing,
            'original_summary': navigation_summary,
            'interpret_result': map_result
        }
    
    async def _rewrite_summary_to_strategic_briefing(self, original_summary_text: str) -> str:
        """
        Takes a structured summary and rewrites it section by section into a cohesive strategic briefing.
        """
        logger.info("Rewriting summary to strategic briefing format")
        
        # --- Step 1: Divide the document into sections ---
        sections = []
        
        # Try numbered headings like "1. ", "2. "
        numbered_sections = re.split(r'\\n(?=\\d+\\.\\s)', original_summary_text)
        if len(numbered_sections) > 1:
            sections = [s.strip() for s in numbered_sections[1:] if s.strip()]
        else:
            # Try ## headings
            header_sections = re.split(r'\\n(?=##\\s)', original_summary_text)
            if len(header_sections) > 1:
                sections = [s.strip() for s in header_sections[1:] if s.strip()]
            else:
                # Try finding sections by keywords like "CLAIMS:", "ENTITIES:", etc.
                keyword_sections = re.split(r'\\n(?=[A-Z][A-Z\\s]+:)', original_summary_text)
                if len(keyword_sections) > 1:
                    sections = [s.strip() for s in keyword_sections[1:] if s.strip()]
                else:
                    # Fallback: split by double newlines and take substantial chunks
                    para_sections = [s.strip() for s in original_summary_text.split('\\n\\n') if len(s.strip()) > 100]
                    sections = para_sections
        
        sections_to_rewrite = sections
        
        # Debug: Print what sections we found
        logger.info(f"Found {len(sections_to_rewrite)} sections to rewrite")
        
        # --- Step 2: Create a rewrite task for each section ---
        if not sections_to_rewrite:
            # If no sections found, treat the whole text as one section
            logger.info("No sections detected, treating whole text as single section")
            sections_to_rewrite = [original_summary_text]
        
        tasks = []
        for section_text in sections_to_rewrite:
            tasks.append(self._rewrite_section_strategically(section_text))
        
        # --- Step 3: Execute all rewrite tasks in parallel ---
        rewritten_sections = await asyncio.gather(*tasks)
        
        # --- Step 4: Assemble the final strategic briefing ---
        # Frame the rewritten content with a new, direct introduction.
        strategic_introduction = "A Briefing on Consultant Responsibilities\\nTo ensure this project aligns with our strategic goals, the consultant's engagement is governed by the following core commitments."
        
        # Join the high-quality rewritten sections together.
        final_body = "\\n\\n".join(rewritten_sections)
        
        return f"{strategic_introduction}\\n\\n{final_body}"
    
    async def _rewrite_section_strategically(self, section_text: str) -> str:
        """
        Worker function to rewrite a single section of text into a strategic tone.
        """
        prompt = f"""You are rewriting a section of a document summary into clear, direct bullet points for an executive briefing.

**Original Section to Rewrite:**
---
{section_text}
---

**Your Instructions:**
1. **Keep the Section Header:** If the section starts with a numbered heading (e.g., "1. Obligation Claims"), preserve it exactly as the first line
2. **Convert Content to Bullet Points:** Transform the body content into 2-4 tight, direct bullet points (use "-")
3. **Use Direct Language:** Write in a clear, authoritative tone. Focus on what "must" happen, what "is required", etc.
4. **Business Focus:** Frame each point around business outcomes, control, oversight, or strategic goals
5. **Keep Citations Hidden:** Include all citation references (e.g., [p1.para2.s3]) at the end of each bullet point for backend processing, but the frontend will make the entire bullet clickable
6. **Be Concise:** Each bullet should be 1-2 sentences maximum

Example output format:
1. Obligation Claims
- The consultant is accountable for applying their expertise to deliver the specific outcomes defined in Exhibit A. The work must meet our standards of quality. [p1.para2.s3]
- Key personnel assigned to this project must remain in place. Changes require our prior written consent to ensure continuity. [p2.para1.s1]

Rewrite the section now, preserving the numbered header and converting content to bullet points:"""
        
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an executive briefing specialist. Create clean, direct bullet points that executives can quickly scan and understand. Focus on accountability, control, and business outcomes."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=500,
                temperature=0.2,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Failed to rewrite section: {e}")
            return f"[Rewrite failed for section: {section_text[:50]}...]"