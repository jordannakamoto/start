"""
Semantic Inference Engine for Rich Document Analysis

This module provides deep semantic analysis that goes beyond simple summarization
to extract qualitative insights, relationships, and structured knowledge.
"""

from typing import Dict, List, Set, Tuple, Optional, Any, NamedTuple
from dataclasses import dataclass, field
from enum import Enum
import asyncio
from openai import AsyncOpenAI
import json
import re

class ContentType(Enum):
    """Document content types for specialized analysis"""
    RESEARCH_PAPER = "research_paper"
    LEGAL_CONTRACT = "legal_contract"
    TECHNICAL_SPEC = "technical_spec"
    BUSINESS_REPORT = "business_report"
    ACADEMIC_ARTICLE = "academic_article"
    POLICY_DOCUMENT = "policy_document"
    GENERAL = "general"

class SemanticElement(Enum):
    """Types of semantic elements to extract"""
    MAIN_ARGUMENT = "main_argument"
    SUPPORTING_EVIDENCE = "supporting_evidence"
    METHODOLOGY = "methodology"
    FINDINGS = "findings"
    CONCLUSION = "conclusion"
    DEFINITION = "definition"
    EXAMPLE = "example"
    COMPARISON = "comparison"
    CAUSATION = "causation"
    RECOMMENDATION = "recommendation"
    CONSTRAINT = "constraint"
    ASSUMPTION = "assumption"

@dataclass
class SemanticUnit:
    """A unit of semantic meaning with rich context"""
    element_type: SemanticElement
    content: str
    citations: List[str]
    confidence: float
    relationships: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_relationship(self, relation_type: str, target_unit: 'SemanticUnit', strength: float = 1.0):
        """Add semantic relationship to another unit"""
        self.relationships.append({
            "type": relation_type,
            "target": target_unit,
            "strength": strength
        })

@dataclass
class DocumentProfile:
    """Rich profile of document characteristics"""
    content_type: ContentType
    domain: str
    complexity_level: str  # "basic", "intermediate", "advanced"
    structure_type: str  # "formal", "informal", "technical"
    key_themes: List[str]
    entity_types: Set[str]
    linguistic_features: Dict[str, Any]

class ContentTypeClassifier:
    """Classify document type for specialized processing"""
    
    async def classify_document(self, segments: List[Dict], openai_client) -> DocumentProfile:
        """Analyze document to determine content type and characteristics"""
        
        # Sample key segments for analysis
        sample_content = self._extract_sample_content(segments)
        
        classification_prompt = f"""Analyze this document sample and provide a detailed profile:

Content Sample:
{sample_content}

Please analyze and respond with JSON containing:
{{
    "content_type": "research_paper|legal_contract|technical_spec|business_report|academic_article|policy_document|general",
    "domain": "specific domain/field",
    "complexity_level": "basic|intermediate|advanced",
    "structure_type": "formal|informal|technical",
    "key_themes": ["theme1", "theme2", "theme3"],
    "entity_types": ["person", "organization", "date", "location", "technical_term"],
    "linguistic_features": {{
        "formality": "high|medium|low",
        "technical_density": "high|medium|low",
        "argument_style": "empirical|theoretical|narrative|procedural"
    }}
}}"""

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert document analyst. Respond only with valid JSON."},
                    {"role": "user", "content": classification_prompt}
                ],
                max_tokens=500,
                temperature=0.1
            )
            
            profile_data = json.loads(response.choices[0].message.content)
            
            return DocumentProfile(
                content_type=ContentType(profile_data.get("content_type", "general")),
                domain=profile_data.get("domain", "unknown"),
                complexity_level=profile_data.get("complexity_level", "intermediate"),
                structure_type=profile_data.get("structure_type", "formal"),
                key_themes=profile_data.get("key_themes", []),
                entity_types=set(profile_data.get("entity_types", [])),
                linguistic_features=profile_data.get("linguistic_features", {})
            )
            
        except Exception as e:
            print(f"Classification error: {e}")
            return DocumentProfile(
                content_type=ContentType.GENERAL,
                domain="unknown",
                complexity_level="intermediate",
                structure_type="formal",
                key_themes=[],
                entity_types=set(),
                linguistic_features={}
            )
    
    def _extract_sample_content(self, segments: List[Dict], max_length: int = 2000) -> str:
        """Extract representative sample for classification"""
        sample_parts = []
        current_length = 0
        
        # Take beginning, middle, and end segments
        segment_indices = [0] + [len(segments) // 2] + [len(segments) - 1]
        
        for idx in segment_indices:
            if idx < len(segments):
                content = segments[idx]['segment']['content']
                if current_length + len(content) <= max_length:
                    sample_parts.append(content)
                    current_length += len(content)
                else:
                    remaining = max_length - current_length
                    sample_parts.append(content[:remaining] + "...")
                    break
                    
        return "\n\n".join(sample_parts)

class SemanticExtractor:
    """Extract semantic elements based on document type"""
    
    def __init__(self):
        self.extraction_strategies = {
            ContentType.RESEARCH_PAPER: self._extract_research_semantics,
            ContentType.LEGAL_CONTRACT: self._extract_legal_semantics,
            ContentType.TECHNICAL_SPEC: self._extract_technical_semantics,
            ContentType.BUSINESS_REPORT: self._extract_business_semantics,
            ContentType.GENERAL: self._extract_general_semantics
        }
    
    async def extract_semantic_units(self, segments: List[Dict], profile: DocumentProfile, openai_client) -> List[SemanticUnit]:
        """Extract semantic units based on document profile"""
        
        extractor = self.extraction_strategies.get(
            profile.content_type, 
            self._extract_general_semantics
        )
        
        return await extractor(segments, profile, openai_client)
    
    async def _extract_research_semantics(self, segments: List[Dict], profile: DocumentProfile, openai_client) -> List[SemanticUnit]:
        """Extract semantic elements from research papers"""
        
        extraction_prompt = self._build_research_extraction_prompt(segments)
        
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert research analyst. Extract semantic elements from academic content."},
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=1500,
                temperature=0.2
            )
            
            return self._parse_semantic_response(response.choices[0].message.content)
            
        except Exception as e:
            print(f"Research extraction error: {e}")
            return []
    
    async def _extract_legal_semantics(self, segments: List[Dict], profile: DocumentProfile, openai_client) -> List[SemanticUnit]:
        """Extract semantic elements from legal documents"""
        
        # Focus on obligations, rights, definitions, conditions
        extraction_prompt = f"""Analyze this legal document and extract key semantic elements:

{self._format_segments_for_analysis(segments)}

Extract and categorize:
1. DEFINITIONS: Key terms and their definitions
2. OBLIGATIONS: What parties must do
3. RIGHTS: What parties are entitled to
4. CONDITIONS: Requirements or triggers
5. CONSTRAINTS: Limitations or restrictions
6. PROCEDURES: Step-by-step processes

For each element, provide:
- Type (definition/obligation/right/condition/constraint/procedure)
- Content (the actual semantic meaning)
- Citations (reference format from source)
- Confidence (0.0-1.0)

Respond in JSON format."""

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert legal analyst. Extract precise legal semantics."},
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=1500,
                temperature=0.1
            )
            
            return self._parse_semantic_response(response.choices[0].message.content)
            
        except Exception as e:
            print(f"Legal extraction error: {e}")
            return []
    
    async def _extract_technical_semantics(self, segments: List[Dict], profile: DocumentProfile, openai_client) -> List[SemanticUnit]:
        """Extract semantic elements from technical specifications"""
        
        extraction_prompt = f"""Analyze this technical document and extract key semantic elements:

{self._format_segments_for_analysis(segments)}

Extract and categorize:
1. REQUIREMENTS: What the system must do
2. SPECIFICATIONS: Technical details and parameters
3. PROCEDURES: Step-by-step technical processes
4. CONSTRAINTS: Technical limitations
5. DEPENDENCIES: What relies on what
6. EXAMPLES: Concrete illustrations

For each element, provide semantic meaning, not just text."""

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert technical analyst. Extract precise technical semantics."},
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=1500,
                temperature=0.2
            )
            
            return self._parse_semantic_response(response.choices[0].message.content)
            
        except Exception as e:
            print(f"Technical extraction error: {e}")
            return []
    
    async def _extract_business_semantics(self, segments: List[Dict], profile: DocumentProfile, openai_client) -> List[SemanticUnit]:
        """Extract semantic elements from business reports"""
        
        extraction_prompt = f"""Analyze this business document and extract key semantic elements:

{self._format_segments_for_analysis(segments)}

Extract and categorize:
1. OBJECTIVES: Business goals and targets
2. STRATEGIES: Approaches and methods
3. FINDINGS: Key insights and discoveries
4. RECOMMENDATIONS: Suggested actions
5. METRICS: Quantitative measures and KPIs
6. RISKS: Potential problems or challenges

Focus on actionable business intelligence, not just description."""

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert business analyst. Extract actionable business intelligence."},
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=1500,
                temperature=0.2
            )
            
            return self._parse_semantic_response(response.choices[0].message.content)
            
        except Exception as e:
            print(f"Business extraction error: {e}")
            return []
    
    async def _extract_general_semantics(self, segments: List[Dict], profile: DocumentProfile, openai_client) -> List[SemanticUnit]:
        """Extract semantic elements from general documents"""
        
        extraction_prompt = f"""Analyze this document and extract key semantic elements:

{self._format_segments_for_analysis(segments)}

Extract and categorize by semantic meaning:
1. MAIN_ARGUMENTS: Central claims or points
2. SUPPORTING_EVIDENCE: Facts, data, examples that support arguments
3. CONCLUSIONS: Final judgments or results
4. DEFINITIONS: Explanations of key concepts
5. COMPARISONS: How things relate or differ
6. CAUSATIONS: Cause-effect relationships

Focus on extracting the semantic meaning and relationships, not just repeating text."""

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert content analyst. Extract deep semantic meaning."},
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=1500,
                temperature=0.2
            )
            
            return self._parse_semantic_response(response.choices[0].message.content)
            
        except Exception as e:
            print(f"General extraction error: {e}")
            return []
    
    def _build_research_extraction_prompt(self, segments: List[Dict]) -> str:
        """Build specialized prompt for research papers"""
        
        formatted_content = self._format_segments_for_analysis(segments)
        
        return f"""Analyze this research content and extract semantic elements:

{formatted_content}

Extract and categorize by research semantics:
1. RESEARCH_QUESTION: What is being investigated
2. METHODOLOGY: How the research is conducted
3. FINDINGS: What was discovered
4. EVIDENCE: Data, results, observations that support findings
5. IMPLICATIONS: What the findings mean
6. LIMITATIONS: Constraints or boundaries of the research
7. FUTURE_WORK: Suggested next steps

For each element, extract the semantic meaning and logical relationships, not just text."""
    
    def _format_segments_for_analysis(self, segments: List[Dict], max_segments: int = 20) -> str:
        """Format segments for semantic analysis"""
        formatted = []
        
        for i, segment in enumerate(segments[:max_segments]):
            seg_data = segment['segment']
            formatted.append(f"[{seg_data['reference']}]: {seg_data['content']}")
            
        return "\n\n".join(formatted)
    
    def _parse_semantic_response(self, response_text: str) -> List[SemanticUnit]:
        """Parse AI response into semantic units"""
        semantic_units = []
        
        try:
            # Try to parse as JSON first
            if response_text.strip().startswith('{') or response_text.strip().startswith('['):
                data = json.loads(response_text)
                return self._parse_json_semantics(data)
        except json.JSONDecodeError:
            pass
        
        # Fallback: parse structured text response
        return self._parse_text_semantics(response_text)
    
    def _parse_json_semantics(self, data: Dict) -> List[SemanticUnit]:
        """Parse JSON-formatted semantic response"""
        units = []
        
        if isinstance(data, dict):
            for element_type, items in data.items():
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict):
                            units.append(SemanticUnit(
                                element_type=self._map_element_type(element_type),
                                content=item.get('content', ''),
                                citations=item.get('citations', []),
                                confidence=item.get('confidence', 0.8),
                                metadata=item.get('metadata', {})
                            ))
        
        return units
    
    def _parse_text_semantics(self, text: str) -> List[SemanticUnit]:
        """Parse text-formatted semantic response"""
        units = []
        
        # Look for structured patterns in the text
        sections = re.split(r'\n\s*\d+\.\s*([A-Z_]+):', text)
        
        for i in range(1, len(sections), 2):
            if i + 1 < len(sections):
                element_type = sections[i].strip()
                content = sections[i + 1].strip()
                
                # Extract citations from content
                citations = re.findall(r'\[([^\]]+)\]', content)
                
                units.append(SemanticUnit(
                    element_type=self._map_element_type(element_type),
                    content=content,
                    citations=citations,
                    confidence=0.7  # Default confidence for text parsing
                ))
        
        return units
    
    def _map_element_type(self, type_string: str) -> SemanticElement:
        """Map string to SemanticElement enum"""
        type_mapping = {
            "MAIN_ARGUMENT": SemanticElement.MAIN_ARGUMENT,
            "SUPPORTING_EVIDENCE": SemanticElement.SUPPORTING_EVIDENCE,
            "METHODOLOGY": SemanticElement.METHODOLOGY,
            "FINDINGS": SemanticElement.FINDINGS,
            "CONCLUSION": SemanticElement.CONCLUSION,
            "DEFINITION": SemanticElement.DEFINITION,
            "EXAMPLE": SemanticElement.EXAMPLE,
            "COMPARISON": SemanticElement.COMPARISON,
            "CAUSATION": SemanticElement.CAUSATION,
            "RECOMMENDATION": SemanticElement.RECOMMENDATION,
            "CONSTRAINT": SemanticElement.CONSTRAINT,
            "ASSUMPTION": SemanticElement.ASSUMPTION,
        }
        
        return type_mapping.get(type_string.upper(), SemanticElement.MAIN_ARGUMENT)

class SemanticSynthesizer:
    """Synthesize semantic units into rich, structured summaries"""
    
    async def synthesize_summary(self, semantic_units: List[SemanticUnit], profile: DocumentProfile, openai_client) -> Dict[str, Any]:
        """Create semantically rich summary from extracted units"""
        
        # Group units by type
        units_by_type = {}
        for unit in semantic_units:
            type_name = unit.element_type.value
            if type_name not in units_by_type:
                units_by_type[type_name] = []
            units_by_type[type_name].append(unit)
        
        # Build synthesis prompt based on document type
        synthesis_prompt = self._build_synthesis_prompt(units_by_type, profile)
        
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": f"You are an expert {profile.domain} analyst. Create a semantically rich, structured summary that reveals deep insights and relationships."},
                    {"role": "user", "content": synthesis_prompt}
                ],
                max_tokens=2500,
                temperature=0.3
            )
            
            return {
                "summary": response.choices[0].message.content,
                "semantic_units": len(semantic_units),
                "unit_types": list(units_by_type.keys()),
                "document_profile": {
                    "type": profile.content_type.value,
                    "domain": profile.domain,
                    "complexity": profile.complexity_level,
                    "themes": profile.key_themes
                }
            }
            
        except Exception as e:
            print(f"Synthesis error: {e}")
            return {
                "summary": "Error generating semantic summary",
                "error": str(e)
            }
    
    def _build_synthesis_prompt(self, units_by_type: Dict[str, List[SemanticUnit]], profile: DocumentProfile) -> str:
        """Build synthesis prompt based on semantic units"""
        
        prompt_parts = [
            f"Create a semantically rich summary of this {profile.content_type.value} document.",
            f"Domain: {profile.domain}",
            f"Key themes: {', '.join(profile.key_themes)}",
            "",
            "Semantic Elements Extracted:"
        ]
        
        for element_type, units in units_by_type.items():
            prompt_parts.append(f"\n{element_type.upper()}:")
            for unit in units:
                citations_str = ", ".join(unit.citations) if unit.citations else "No citations"
                prompt_parts.append(f"  - {unit.content} [{citations_str}]")
        
        prompt_parts.extend([
            "",
            "Instructions:",
            "1. Synthesize these semantic elements into a coherent, insightful summary",
            "2. Reveal relationships and patterns between elements",
            "3. Provide analysis that goes beyond surface-level description",
            "4. Include precise citations for all claims",
            "5. Structure the summary to highlight key insights and implications",
            "6. Use the semantic elements to create a narrative that reveals understanding",
            "",
            "Focus on semantic richness: What does this document really mean? What are the deeper implications? How do the elements connect?"
        ])
        
        return "\n".join(prompt_parts)

class SemanticInferenceEngine:
    """Main interface for semantic document analysis"""
    
    def __init__(self, openai_client):
        self.openai_client = openai_client
        self.classifier = ContentTypeClassifier()
        self.extractor = SemanticExtractor()
        self.synthesizer = SemanticSynthesizer()
    
    async def analyze_document(self, segments: List[Dict]) -> Dict[str, Any]:
        """Perform complete semantic analysis of document"""
        
        # Step 1: Classify document type and characteristics
        profile = await self.classifier.classify_document(segments, self.openai_client)
        
        # Step 2: Extract semantic units based on document type
        semantic_units = await self.extractor.extract_semantic_units(segments, profile, self.openai_client)
        
        # Step 3: Synthesize semantic units into rich summary
        synthesis_result = await self.synthesizer.synthesize_summary(semantic_units, profile, self.openai_client)
        
        return {
            "document_profile": profile,
            "semantic_units": semantic_units,
            "synthesis": synthesis_result,
            "analysis_metadata": {
                "total_segments_analyzed": len(segments),
                "semantic_units_extracted": len(semantic_units),
                "confidence_score": self._calculate_overall_confidence(semantic_units)
            }
        }
    
    def _calculate_overall_confidence(self, units: List[SemanticUnit]) -> float:
        """Calculate overall confidence in the semantic analysis"""
        if not units:
            return 0.0
        
        total_confidence = sum(unit.confidence for unit in units)
        return total_confidence / len(units)