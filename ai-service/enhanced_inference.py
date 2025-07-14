"""
Enhanced Inference Engine with Citation-Aware Semantic Analysis

This creates a two-stage process:
1. Semantic structure extraction with citation validation
2. Clean user-facing summary generation for navigation
"""

from typing import Dict, List, Set, Tuple, Optional, Any, NamedTuple
from dataclasses import dataclass, field
from enum import Enum
import asyncio
from openai import AsyncOpenAI
import json
import re

@dataclass
class SemanticClaim:
    """A semantic claim with validated citations"""
    claim_type: str  # "obligation", "definition", "finding", etc.
    content: str     # The semantic meaning
    citations: List[str]  # Validated citation references
    confidence: float
    evidence_text: str  # Original text that supports this claim
    
@dataclass
class DocumentStructure:
    """Internal semantic structure before user summary"""
    document_type: str
    key_claims: List[SemanticClaim]
    themes: List[str]
    relationships: List[Dict[str, Any]]

class EnhancedInferenceEngine:
    """Two-stage inference: semantic extraction + user summary"""
    
    def __init__(self, openai_client):
        self.openai_client = openai_client
    
    async def analyze_document(self, segments: List[Dict]) -> Dict[str, Any]:
        """Complete analysis: semantic extraction + user summary"""
        
        # Stage 1: Extract semantic structure with citations
        semantic_structure = await self._extract_semantic_structure(segments)
        
        # Stage 2: Generate clean user summary for navigation
        user_summary = await self._generate_navigation_summary(semantic_structure, segments)
        
        return {
            "user_summary": user_summary,
            "internal_structure": semantic_structure,  # For debugging/analysis
            "citation_count": sum(len(claim.citations) for claim in semantic_structure.key_claims)
        }
    
    async def _extract_semantic_structure(self, segments: List[Dict]) -> DocumentStructure:
        """Extract semantic structure with validated citations"""
        
        # First, classify document type
        doc_type = await self._classify_document(segments)
        
        # Create citation-aware extraction prompt
        extraction_prompt = self._build_citation_extraction_prompt(segments, doc_type)
        
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert analyst. Extract semantic claims with precise citations. Always include the exact citation reference [pX.paraY.sZ] for each claim."},
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=1500,
                temperature=0.1
            )
            
            # Parse response and validate citations
            claims = self._parse_and_validate_claims(response.choices[0].message.content, segments)
            
            return DocumentStructure(
                document_type=doc_type,
                key_claims=claims,
                themes=self._extract_themes(claims),
                relationships=[]
            )
            
        except Exception as e:
            print(f"Semantic extraction error: {e}")
            return DocumentStructure(
                document_type="unknown",
                key_claims=[],
                themes=[],
                relationships=[]
            )
    
    async def _classify_document(self, segments: List[Dict]) -> str:
        """Quick document type classification"""
        sample_text = " ".join([seg['segment']['content'][:200] for seg in segments[:3]])
        
        classification_prompt = f"""Classify this document type based on the content sample:

{sample_text}

Respond with ONE of: legal_contract, research_paper, technical_spec, business_report, policy_document, academic_article, general"""
        
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a document classifier. Respond with only the document type."},
                    {"role": "user", "content": classification_prompt}
                ],
                max_tokens=20,
                temperature=0.0
            )
            
            return response.choices[0].message.content.strip().lower()
            
        except Exception as e:
            print(f"Classification error: {e}")
            return "general"
    
    def _build_citation_extraction_prompt(self, segments: List[Dict], doc_type: str) -> str:
        """Build extraction prompt with citation requirements"""
        
        # Format segments with clear citation references
        formatted_segments = []
        for segment in segments[:25]:  # Limit for prompt size
            seg_data = segment['segment']
            formatted_segments.append(f"[{seg_data['reference']}]: {seg_data['content']}")
        
        segments_text = "\n\n".join(formatted_segments)
        
        if doc_type == "legal_contract":
            claim_types = ["obligation", "right", "definition", "condition", "constraint", "procedure"]
            instructions = "Extract legal obligations, rights, definitions, and procedures. Each must have specific citation."
        elif doc_type == "research_paper":
            claim_types = ["research_question", "methodology", "finding", "evidence", "conclusion", "limitation"]
            instructions = "Extract research questions, methodologies, key findings, and conclusions. Each must have specific citation."
        elif doc_type == "technical_spec":
            claim_types = ["requirement", "specification", "procedure", "constraint", "dependency"]
            instructions = "Extract technical requirements, specifications, and procedures. Each must have specific citation."
        else:
            claim_types = ["main_point", "supporting_evidence", "conclusion", "definition", "example"]
            instructions = "Extract main points, supporting evidence, and conclusions. Each must have specific citation."
        
        return f"""Analyze this {doc_type} document and extract semantic claims with precise citations.

Document Content:
{segments_text}

{instructions}

For each claim, provide:
1. Type: {' | '.join(claim_types)}
2. Content: The semantic meaning (not just quoted text)
3. Citation: The exact reference [pX.paraY.sZ] from the source
4. Evidence: The specific text that supports this claim

Format your response as:

**CLAIM_TYPE**: [Clear semantic statement]
Citation: [pX.paraY.sZ]
Evidence: "Exact text from document"
---

**CLAIM_TYPE**: [Another semantic statement]
Citation: [pX.paraY.sZ]
Evidence: "Exact text from document"
---

CRITICAL: Every claim MUST have a specific citation reference. No claim without citation."""
    
    def _parse_and_validate_claims(self, response_text: str, segments: List[Dict]) -> List[SemanticClaim]:
        """Parse AI response and validate citations exist"""
        claims = []
        
        # Create citation lookup
        citation_lookup = {}
        for segment in segments:
            ref = segment['segment']['reference']
            citation_lookup[ref] = segment['segment']['content']
        
        # Parse response sections
        sections = response_text.split('---')
        
        for section in sections:
            section = section.strip()
            if not section:
                continue
                
            # Extract claim type and content
            claim_match = re.search(r'\*\*([^*]+)\*\*:\s*(.+?)(?=Citation:|$)', section, re.DOTALL)
            if not claim_match:
                continue
                
            claim_type = claim_match.group(1).strip()
            content = claim_match.group(2).strip()
            
            # Extract citation
            citation_match = re.search(r'Citation:\s*\[([^\]]+)\]', section)
            if not citation_match:
                continue  # Skip claims without citations
                
            citation_ref = citation_match.group(1)
            
            # Validate citation exists
            if citation_ref not in citation_lookup:
                print(f"Warning: Citation {citation_ref} not found in segments")
                continue
            
            # Extract evidence
            evidence_match = re.search(r'Evidence:\s*"([^"]+)"', section)
            evidence_text = evidence_match.group(1) if evidence_match else citation_lookup[citation_ref]
            
            claims.append(SemanticClaim(
                claim_type=claim_type.lower(),
                content=content,
                citations=[citation_ref],
                confidence=0.8,
                evidence_text=evidence_text
            ))
        
        return claims
    
    def _extract_themes(self, claims: List[SemanticClaim]) -> List[str]:
        """Extract key themes from claims"""
        themes = set()
        
        for claim in claims:
            # Simple keyword extraction for themes
            words = claim.content.lower().split()
            for word in words:
                if len(word) > 6 and word.isalpha():  # Rough theme detection
                    themes.add(word)
        
        return list(themes)[:5]  # Top 5 themes
    
    async def _generate_navigation_summary(self, structure: DocumentStructure, segments: List[Dict]) -> str:
        """Generate clean, user-facing navigation summary"""
        
        if not structure.key_claims:
            return "Unable to extract structured information from this document."
        
        # Group claims by type
        claims_by_type = {}
        for claim in structure.key_claims:
            claim_type = claim.claim_type
            if claim_type not in claims_by_type:
                claims_by_type[claim_type] = []
            claims_by_type[claim_type].append(claim)
        
        # Build summary sections
        summary_parts = []
        
        if structure.document_type == "legal_contract":
            summary_parts.append("# Legal Contract Summary\n")
            summary_parts.extend(self._build_legal_navigation(claims_by_type))
        elif structure.document_type == "research_paper":
            summary_parts.append("# Research Paper Summary\n")
            summary_parts.extend(self._build_research_navigation(claims_by_type))
        elif structure.document_type == "technical_spec":
            summary_parts.append("# Technical Specification Summary\n")
            summary_parts.extend(self._build_technical_navigation(claims_by_type))
        else:
            summary_parts.append("# Document Summary\n")
            summary_parts.extend(self._build_general_navigation(claims_by_type))
        
        return "\n".join(summary_parts)
    
    def _build_legal_navigation(self, claims_by_type: Dict[str, List[SemanticClaim]]) -> List[str]:
        """Build legal document navigation"""
        sections = []
        
        if "obligation" in claims_by_type:
            sections.append("## Key Obligations")
            for claim in claims_by_type["obligation"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "right" in claims_by_type:
            sections.append("## Rights and Entitlements")
            for claim in claims_by_type["right"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "definition" in claims_by_type:
            sections.append("## Key Definitions")
            for claim in claims_by_type["definition"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "condition" in claims_by_type:
            sections.append("## Conditions and Requirements")
            for claim in claims_by_type["condition"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        return sections
    
    def _build_research_navigation(self, claims_by_type: Dict[str, List[SemanticClaim]]) -> List[str]:
        """Build research paper navigation"""
        sections = []
        
        if "research_question" in claims_by_type:
            sections.append("## Research Questions")
            for claim in claims_by_type["research_question"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "methodology" in claims_by_type:
            sections.append("## Methodology")
            for claim in claims_by_type["methodology"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "finding" in claims_by_type:
            sections.append("## Key Findings")
            for claim in claims_by_type["finding"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "conclusion" in claims_by_type:
            sections.append("## Conclusions")
            for claim in claims_by_type["conclusion"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        return sections
    
    def _build_technical_navigation(self, claims_by_type: Dict[str, List[SemanticClaim]]) -> List[str]:
        """Build technical specification navigation"""
        sections = []
        
        if "requirement" in claims_by_type:
            sections.append("## Requirements")
            for claim in claims_by_type["requirement"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "specification" in claims_by_type:
            sections.append("## Technical Specifications")
            for claim in claims_by_type["specification"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "procedure" in claims_by_type:
            sections.append("## Procedures")
            for claim in claims_by_type["procedure"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        return sections
    
    def _build_general_navigation(self, claims_by_type: Dict[str, List[SemanticClaim]]) -> List[str]:
        """Build general document navigation"""
        sections = []
        
        if "main_point" in claims_by_type:
            sections.append("## Main Points")
            for claim in claims_by_type["main_point"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "supporting_evidence" in claims_by_type:
            sections.append("## Supporting Evidence")
            for claim in claims_by_type["supporting_evidence"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        if "conclusion" in claims_by_type:
            sections.append("## Conclusions")
            for claim in claims_by_type["conclusion"]:
                citation_str = ", ".join(claim.citations)
                sections.append(f"- {claim.content} `{citation_str}`")
            sections.append("")
        
        return sections