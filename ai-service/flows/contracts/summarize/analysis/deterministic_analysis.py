"""
Deterministic Semantic Analysis Framework

This provides rigorous, structured semantic analysis with:
- Rule-based content extraction
- Deterministic processing pipelines  
- Structured knowledge representation
- Thorough validation and verification
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re
from collections import defaultdict

class ContentPattern(Enum):
    """Deterministic content patterns for extraction"""
    OBLIGATION_MODAL = "obligation_modal"       # "must", "shall", "required"
    PROHIBITION_MODAL = "prohibition_modal"     # "may not", "shall not", "prohibited"
    PERMISSION_MODAL = "permission_modal"       # "may", "can", "allowed"
    DEFINITION_PATTERN = "definition_pattern"   # "means", "refers to", "is defined as"
    CONDITIONAL_PATTERN = "conditional_pattern" # "if", "when", "provided that"
    TEMPORAL_PATTERN = "temporal_pattern"       # "within", "before", "after", dates
    QUANTITATIVE_PATTERN = "quantitative"      # numbers, percentages, measurements
    ENTITY_REFERENCE = "entity_reference"      # proper nouns, organizations, people
    STATEMENT_PATTERN = "statement_pattern"    # general statements and claims

@dataclass
class StructuredClaim:
    """Rigorous structured claim with validation"""
    claim_id: str
    claim_type: str
    subject: str           # Who/what the claim is about
    predicate: str         # What action/state is described
    object: Optional[str]  # Target of the action (if applicable)
    modality: str          # "must", "may", "shall not", etc.
    conditions: List[str]  # Any conditional clauses
    temporal_scope: Optional[str]  # Time constraints
    quantifiers: List[str] # Numbers, amounts, frequencies
    evidence_text: str     # Exact supporting text
    citations: List[str]   # Validated citation references
    confidence: float      # Deterministic confidence score
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class KnowledgeGraph:
    """Structured knowledge representation"""
    entities: Dict[str, Dict[str, Any]]  # entity_id -> properties
    relationships: List[Dict[str, Any]]   # subject -> predicate -> object
    claims: List[StructuredClaim]
    temporal_order: List[str]             # Ordered sequence of events/claims
    hierarchical_structure: Dict[str, List[str]]  # parent -> children

class DeterministicPatternMatcher:
    """Rule-based pattern matching for semantic extraction"""
    
    def __init__(self):
        # Initialize spaCy for enhanced linguistic analysis
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            print("🔍 Using spaCy-powered deterministic analysis with linguistic features")
        except ImportError:
            self.nlp = None
            print("🔍 spaCy not available, using lightweight analysis")
        except OSError:
            self.nlp = None
            print("🔍 spaCy model not found, using lightweight analysis")
        
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile deterministic extraction patterns"""
        
        # Modal verb patterns for legal/obligation analysis
        self.obligation_patterns = [
            r'\b(?:must|shall|required to|obligated to|duty to)\b',
            r'\b(?:agrees to|undertakes to|commits to)\b',
            r'\b(?:responsible for|liable for)\b'
        ]
        
        self.prohibition_patterns = [
            r'\b(?:shall not|must not|may not|cannot|prohibited from)\b',
            r'\b(?:forbidden to|restricted from|banned from)\b'
        ]
        
        self.permission_patterns = [
            r'\b(?:may|can|allowed to|permitted to|authorized to)\b',
            r'\b(?:has the right to|entitled to)\b'
        ]
        
        # Definition patterns
        self.definition_patterns = [
            r'(?P<term>\w+(?:\s+\w+)*)\s+(?:means|refers to|is defined as|shall mean)\s+(?P<definition>.+?)(?:\.|;|$)',
            r'"(?P<term>[^"]+)"\s+(?:means|refers to|is defined as)\s+(?P<definition>.+?)(?:\.|;|$)',
            r'(?P<term>\w+(?:\s+\w+)*)\s*:\s*(?P<definition>.+?)(?:\.|;|$)',
            r'(?P<term>\w+(?:\s+\w+)*)\s+(?:is|are)\s+(?P<definition>a\s+.+?)(?:\.|;|$)',
            r'(?P<term>\w+(?:\s+\w+)*)\s+(?:include|includes|consist of|comprises)\s+(?P<definition>.+?)(?:\.|;|$)'
        ]
        
        # Conditional patterns
        self.conditional_patterns = [
            r'(?:if|when|where|provided that|subject to|in the event that)\s+(?P<condition>.+?)(?:,|\bthen\b)',
            r'(?P<condition>.+?)\s+(?:if and only if|unless)\s+(?P<main_clause>.+)',
        ]
        
        # Temporal patterns
        self.temporal_patterns = [
            r'(?:within|before|after|by|no later than)\s+(?P<timeframe>\d+\s+(?:days?|weeks?|months?|years?))',
            r'(?P<date>\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'(?P<relative_time>immediately|promptly|forthwith|without delay)'
        ]
        
        # Quantitative patterns
        self.quantitative_patterns = [
            r'(?P<number>\d+(?:\.\d+)?)\s*(?P<unit>%|percent|dollars?|\$|euros?|pounds?)',
            r'(?P<quantity>not? (?:more|less) than\s+\d+)',
            r'(?P<range>\d+\s*(?:to|-)\s*\d+)'
        ]
        
        # Statement patterns for general content
        self.statement_patterns = [
            r'(?P<subject>\w+(?:\s+\w+)*)\s+(?:is|are|was|were|has|have|represents?|enables?|includes?)\s+(?P<predicate>.+?)(?:\.|;|$)',
            r'(?P<subject>The\s+\w+(?:\s+\w+)*)\s+(?:of|in|for)\s+(?P<object>\w+(?:\s+\w+)*)\s+(?P<predicate>.+?)(?:\.|;|$)',
            r'(?P<conclusion>Conclusion|In conclusion|Therefore|Thus|Hence):\s*(?P<statement>.+?)(?:\.|;|$)'
        ]
        
        # Compile all patterns
        self.compiled_patterns = {
            ContentPattern.OBLIGATION_MODAL: [re.compile(p, re.IGNORECASE) for p in self.obligation_patterns],
            ContentPattern.PROHIBITION_MODAL: [re.compile(p, re.IGNORECASE) for p in self.prohibition_patterns],
            ContentPattern.PERMISSION_MODAL: [re.compile(p, re.IGNORECASE) for p in self.permission_patterns],
            ContentPattern.DEFINITION_PATTERN: [re.compile(p, re.IGNORECASE | re.DOTALL) for p in self.definition_patterns],
            ContentPattern.CONDITIONAL_PATTERN: [re.compile(p, re.IGNORECASE | re.DOTALL) for p in self.conditional_patterns],
            ContentPattern.TEMPORAL_PATTERN: [re.compile(p, re.IGNORECASE) for p in self.temporal_patterns],
            ContentPattern.QUANTITATIVE_PATTERN: [re.compile(p, re.IGNORECASE) for p in self.quantitative_patterns],
            ContentPattern.STATEMENT_PATTERN: [re.compile(p, re.IGNORECASE | re.DOTALL) for p in self.statement_patterns]
        }
    
    def extract_patterns(self, text: str, citation_ref: str) -> List[Dict[str, Any]]:
        """Extract all deterministic patterns from text"""
        matches = []
        
        for pattern_type, compiled_patterns in self.compiled_patterns.items():
            for pattern in compiled_patterns:
                for match in pattern.finditer(text):
                    match_data = {
                        "pattern_type": pattern_type,
                        "match_text": match.group(0),
                        "start_pos": match.start(),
                        "end_pos": match.end(),
                        "citation": citation_ref,
                        "groups": match.groupdict() if match.groupdict() else {},
                        "full_context": text[max(0, match.start()-50):match.end()+50]
                    }
                    matches.append(match_data)
        
        return matches

class StructuredKnowledgeExtractor:
    """Extract structured knowledge using deterministic methods"""
    
    def __init__(self):
        self.pattern_matcher = DeterministicPatternMatcher()
        self.entity_cache = {}
        
    def extract_structured_knowledge(self, segments: List[Dict]) -> KnowledgeGraph:
        """Extract structured knowledge from document segments"""
        
        # Initialize knowledge graph
        kg = KnowledgeGraph(
            entities={},
            relationships=[],
            claims=[],
            temporal_order=[],
            hierarchical_structure={}
        )
        
        # Process each segment deterministically
        for segment in segments:
            seg_data = segment['segment']
            content = seg_data['content']
            citation = seg_data['reference']
            
            # Extract patterns
            patterns = self.pattern_matcher.extract_patterns(content, citation)
            
            # Convert patterns to structured claims
            claims = self._patterns_to_claims(patterns, content, citation)
            kg.claims.extend(claims)
            
            # Extract entities
            entities = self._extract_entities(content, citation)
            kg.entities.update(entities)
            
            # Extract relationships
            relationships = self._extract_relationships(content, citation, patterns)
            kg.relationships.extend(relationships)
        
        # Build temporal ordering
        kg.temporal_order = self._build_temporal_order(kg.claims)
        
        # Build hierarchical structure
        kg.hierarchical_structure = self._build_hierarchy(kg.claims)
        
        return kg
    
    def _patterns_to_claims(self, patterns: List[Dict], content: str, citation: str) -> List[StructuredClaim]:
        """Convert pattern matches to structured claims"""
        claims = []
        claim_counter = 0
        
        # Group patterns by sentence for context
        doc_sentences = self._split_into_sentences(content)
        
        for pattern in patterns:
            claim_counter += 1
            
            # Find which sentence contains this pattern
            containing_sentence = self._find_containing_sentence(
                pattern['start_pos'], doc_sentences
            )
            
            if not containing_sentence:
                continue
            
            # Extract structured components
            claim = self._extract_claim_structure(
                pattern, containing_sentence, citation, f"{citation}_claim_{claim_counter}"
            )
            
            if claim:
                claims.append(claim)
        
        return claims
    
    def _extract_claim_structure(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> Optional[StructuredClaim]:
        """Extract structured claim components from pattern match"""
        
        pattern_type = pattern['pattern_type']
        
        if pattern_type == ContentPattern.OBLIGATION_MODAL:
            return self._extract_obligation_claim(pattern, sentence, citation, claim_id)
        elif pattern_type == ContentPattern.PROHIBITION_MODAL:
            return self._extract_prohibition_claim(pattern, sentence, citation, claim_id)
        elif pattern_type == ContentPattern.PERMISSION_MODAL:
            return self._extract_permission_claim(pattern, sentence, citation, claim_id)
        elif pattern_type == ContentPattern.DEFINITION_PATTERN:
            return self._extract_definition_claim(pattern, sentence, citation, claim_id)
        elif pattern_type == ContentPattern.CONDITIONAL_PATTERN:
            return self._extract_conditional_claim(pattern, sentence, citation, claim_id)
        elif pattern_type == ContentPattern.STATEMENT_PATTERN:
            return self._extract_statement_claim(pattern, sentence, citation, claim_id)
        
        return None
    
    def _extract_obligation_claim(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> StructuredClaim:
        """Extract obligation claim structure"""
        
        # Parse sentence to find subject, predicate, object
        parsed = self._parse_sentence_structure(sentence)
        
        # Extract temporal constraints
        temporal = self._extract_temporal_constraints(sentence)
        
        # Extract conditions
        conditions = self._extract_conditions(sentence)
        
        # Extract quantifiers
        quantifiers = self._extract_quantifiers(sentence)
        
        return StructuredClaim(
            claim_id=claim_id,
            claim_type="obligation",
            subject=parsed.get("subject", "unknown"),
            predicate=parsed.get("predicate", pattern['match_text']),
            object=parsed.get("object"),
            modality=pattern['match_text'].lower(),
            conditions=conditions,
            temporal_scope=temporal,
            quantifiers=quantifiers,
            evidence_text=sentence,
            citations=[citation],
            confidence=self._calculate_deterministic_confidence(pattern, sentence)
        )
    
    def _extract_prohibition_claim(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> StructuredClaim:
        """Extract prohibition claim structure"""
        parsed = self._parse_sentence_structure(sentence)
        
        return StructuredClaim(
            claim_id=claim_id,
            claim_type="prohibition",
            subject=parsed.get("subject", "unknown"),
            predicate=parsed.get("predicate", pattern['match_text']),
            object=parsed.get("object"),
            modality=pattern['match_text'].lower(),
            conditions=self._extract_conditions(sentence),
            temporal_scope=self._extract_temporal_constraints(sentence),
            quantifiers=self._extract_quantifiers(sentence),
            evidence_text=sentence,
            citations=[citation],
            confidence=self._calculate_deterministic_confidence(pattern, sentence)
        )
    
    def _extract_permission_claim(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> StructuredClaim:
        """Extract permission claim structure"""
        parsed = self._parse_sentence_structure(sentence)
        
        return StructuredClaim(
            claim_id=claim_id,
            claim_type="permission",
            subject=parsed.get("subject", "unknown"),
            predicate=parsed.get("predicate", pattern['match_text']),
            object=parsed.get("object"),
            modality=pattern['match_text'].lower(),
            conditions=self._extract_conditions(sentence),
            temporal_scope=self._extract_temporal_constraints(sentence),
            quantifiers=self._extract_quantifiers(sentence),
            evidence_text=sentence,
            citations=[citation],
            confidence=self._calculate_deterministic_confidence(pattern, sentence)
        )
    
    def _extract_definition_claim(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> StructuredClaim:
        """Extract definition claim structure"""
        groups = pattern.get('groups', {})
        
        return StructuredClaim(
            claim_id=claim_id,
            claim_type="definition",
            subject=groups.get('term', 'unknown term'),
            predicate="is defined as",
            object=groups.get('definition', sentence),
            modality="definitional",
            conditions=[],
            temporal_scope=None,
            quantifiers=[],
            evidence_text=sentence,
            citations=[citation],
            confidence=self._calculate_deterministic_confidence(pattern, sentence)
        )
    
    def _extract_conditional_claim(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> StructuredClaim:
        """Extract conditional claim structure"""
        groups = pattern.get('groups', {})
        
        return StructuredClaim(
            claim_id=claim_id,
            claim_type="conditional",
            subject="conditional statement",
            predicate="if-then relationship",
            object=sentence,
            modality="conditional",
            conditions=[groups.get('condition', '')],
            temporal_scope=self._extract_temporal_constraints(sentence),
            quantifiers=self._extract_quantifiers(sentence),
            evidence_text=sentence,
            citations=[citation],
            confidence=self._calculate_deterministic_confidence(pattern, sentence)
        )
    
    def _extract_statement_claim(self, pattern: Dict, sentence: str, citation: str, claim_id: str) -> StructuredClaim:
        """Extract general statement claim structure"""
        groups = pattern.get('groups', {})
        
        # Determine claim type based on pattern
        if groups.get('conclusion'):
            claim_type = "conclusion"
            subject = "conclusion"
            predicate = "states"
            object_term = groups.get('statement', sentence)
        else:
            claim_type = "statement"
            subject = groups.get('subject', 'unknown')
            predicate = groups.get('predicate', pattern['match_text'])
            object_term = groups.get('object')
        
        return StructuredClaim(
            claim_id=claim_id,
            claim_type=claim_type,
            subject=subject,
            predicate=predicate,
            object=object_term,
            modality="factual",
            conditions=self._extract_conditions(sentence),
            temporal_scope=self._extract_temporal_constraints(sentence),
            quantifiers=self._extract_quantifiers(sentence),
            evidence_text=sentence,
            citations=[citation],
            confidence=self._calculate_deterministic_confidence(pattern, sentence)
        )
    
    def _parse_sentence_structure(self, sentence: str) -> Dict[str, str]:
        """Parse sentence into subject, predicate, object using linguistic analysis"""
        
        if not self.pattern_matcher.nlp:
            # Fallback to simple parsing
            return self._simple_sentence_parse(sentence)
        
        doc = self.pattern_matcher.nlp(sentence)
        
        subject = None
        predicate = None
        object_term = None
        
        # Find main verb (predicate)
        for token in doc:
            if token.dep_ == "ROOT" and token.pos_ == "VERB":
                predicate = token.lemma_
                break
        
        # Find subject
        for token in doc:
            if token.dep_ in ["nsubj", "nsubjpass"]:
                subject = token.text
                # Include compound subjects
                subject_tokens = [child.text for child in token.children if child.dep_ == "compound"]
                if subject_tokens:
                    subject = " ".join(subject_tokens + [subject])
                break
        
        # Find object
        for token in doc:
            if token.dep_ in ["dobj", "pobj", "attr"]:
                object_term = token.text
                # Include compound objects
                object_tokens = [child.text for child in token.children if child.dep_ == "compound"]
                if object_tokens:
                    object_term = " ".join(object_tokens + [object_term])
                break
        
        return {
            "subject": subject or "unknown",
            "predicate": predicate or "unknown", 
            "object": object_term
        }
    
    def _simple_sentence_parse(self, sentence: str) -> Dict[str, str]:
        """Simple fallback sentence parsing"""
        words = sentence.split()
        
        # Very basic subject-verb-object detection
        subject = "unknown"
        predicate = "unknown"
        object_term = None
        
        # Look for common patterns
        for i, word in enumerate(words):
            if word.lower() in ["must", "shall", "may", "can", "will"]:
                if i > 0:
                    subject = " ".join(words[:i])
                if i < len(words) - 1:
                    predicate = " ".join(words[i:i+2])
                if i < len(words) - 2:
                    object_term = " ".join(words[i+2:])
                break
        
        return {
            "subject": subject,
            "predicate": predicate,
            "object": object_term
        }
    
    def _extract_temporal_constraints(self, text: str) -> Optional[str]:
        """Extract temporal constraints from text"""
        temporal_patterns = [
            r'within\s+(\d+\s+(?:days?|weeks?|months?|years?))',
            r'(?:before|after|by)\s+([^,.\n]+)',
            r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'(immediately|promptly|forthwith|without delay)'
        ]
        
        for pattern in temporal_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1) if len(match.groups()) > 0 else match.group(0)
        
        return None
    
    def _extract_conditions(self, text: str) -> List[str]:
        """Extract conditional clauses from text"""
        conditions = []
        
        # Look for conditional patterns
        conditional_words = ["if", "when", "where", "provided that", "subject to", "unless"]
        
        for word in conditional_words:
            pattern = rf'\b{word}\b\s+([^,.\n]+)'
            matches = re.findall(pattern, text, re.IGNORECASE)
            conditions.extend(matches)
        
        return [cond.strip() for cond in conditions if cond.strip()]
    
    def _extract_quantifiers(self, text: str) -> List[str]:
        """Extract quantitative information from text"""
        quantifiers = []
        
        # Number patterns
        number_patterns = [
            r'\d+(?:\.\d+)?\s*%',
            r'\$\d+(?:\.\d+)?',
            r'\d+\s+(?:days?|weeks?|months?|years?)',
            r'(?:not?\s+)?(?:more|less)\s+than\s+\d+',
            r'\d+\s*(?:to|-)\s*\d+'
        ]
        
        for pattern in number_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            quantifiers.extend(matches)
        
        return quantifiers
    
    def _calculate_deterministic_confidence(self, pattern: Dict, sentence: str) -> float:
        """Calculate confidence score based on deterministic factors"""
        confidence = 0.5  # Base confidence
        
        # Pattern specificity bonus
        if pattern['pattern_type'] in [ContentPattern.OBLIGATION_MODAL, ContentPattern.PROHIBITION_MODAL]:
            confidence += 0.3
        
        # Sentence completeness
        if len(sentence.split()) > 5:
            confidence += 0.1
        
        # Contains specific terms
        specific_terms = ["shall", "must", "required", "prohibited", "means"]
        if any(term in sentence.lower() for term in specific_terms):
            confidence += 0.1
        
        return min(1.0, confidence)
    
    def _split_into_sentences(self, text: str) -> List[Tuple[str, int, int]]:
        """Split text into sentences with position tracking"""
        sentences = []
        
        # Simple sentence splitting
        sentence_pattern = r'[.!?]+\s+'
        start_pos = 0
        
        for match in re.finditer(sentence_pattern, text):
            end_pos = match.start() + 1
            sentence = text[start_pos:end_pos].strip()
            if sentence:
                sentences.append((sentence, start_pos, end_pos))
            start_pos = match.end()
        
        # Add final sentence if text doesn't end with punctuation
        if start_pos < len(text):
            final_sentence = text[start_pos:].strip()
            if final_sentence:
                sentences.append((final_sentence, start_pos, len(text)))
        
        return sentences
    
    def _find_containing_sentence(self, pos: int, sentences: List[Tuple[str, int, int]]) -> Optional[str]:
        """Find which sentence contains the given position"""
        for sentence, start, end in sentences:
            if start <= pos <= end:
                return sentence
        return None
    
    def _extract_entities(self, content: str, citation: str) -> Dict[str, Dict[str, Any]]:
        """Extract named entities deterministically"""
        entities = {}
        
        if not self.pattern_matcher.nlp:
            return self._simple_entity_extraction(content, citation)
        
        doc = self.pattern_matcher.nlp(content)
        
        for ent in doc.ents:
            entity_id = f"{ent.text}_{ent.label_}"
            entities[entity_id] = {
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char,
                "citation": citation,
                "context": content[max(0, ent.start_char-20):ent.end_char+20]
            }
        
        return entities
    
    def _simple_entity_extraction(self, content: str, citation: str) -> Dict[str, Dict[str, Any]]:
        """Simple entity extraction fallback"""
        entities = {}
        
        # Look for capitalized words (potential proper nouns)
        proper_nouns = re.findall(r'\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b', content)
        
        # Also look for common patterns
        date_pattern = r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b'
        money_pattern = r'\$\d+(?:,\d{3})*(?:\.\d{2})?'
        percentage_pattern = r'\d+(?:\.\d+)?%'
        
        # Extract dates
        dates = re.findall(date_pattern, content)
        for i, date in enumerate(dates):
            entity_id = f"date_{i}"
            entities[entity_id] = {
                "text": date,
                "label": "DATE",
                "citation": citation,
                "context": content
            }
        
        # Extract monetary amounts
        money_amounts = re.findall(money_pattern, content)
        for i, amount in enumerate(money_amounts):
            entity_id = f"money_{i}"
            entities[entity_id] = {
                "text": amount,
                "label": "MONEY",
                "citation": citation,
                "context": content
            }
        
        # Extract percentages
        percentages = re.findall(percentage_pattern, content)
        for i, percent in enumerate(percentages):
            entity_id = f"percent_{i}"
            entities[entity_id] = {
                "text": percent,
                "label": "PERCENT",
                "citation": citation,
                "context": content
            }
        
        # Extract proper nouns
        for i, noun in enumerate(proper_nouns):
            if len(noun) > 2:  # Filter out short words
                entity_id = f"entity_{i}"
                entities[entity_id] = {
                    "text": noun,
                    "label": "UNKNOWN",
                    "citation": citation,
                    "context": content
                }
        
        return entities
    
    def _extract_relationships(self, content: str, citation: str, patterns: List[Dict]) -> List[Dict[str, Any]]:
        """Extract semantic relationships"""
        relationships = []
        
        # Look for relationship patterns
        relationship_patterns = [
            r'(\w+(?:\s+\w+)*)\s+(?:is|are)\s+(\w+(?:\s+\w+)*)',
            r'(\w+(?:\s+\w+)*)\s+(?:has|have)\s+(\w+(?:\s+\w+)*)',
            r'(\w+(?:\s+\w+)*)\s+(?:provides?|includes?)\s+(\w+(?:\s+\w+)*)'
        ]
        
        for pattern in relationship_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                relationships.append({
                    "subject": match[0].strip(),
                    "predicate": "relates_to",
                    "object": match[1].strip(),
                    "citation": citation,
                    "evidence": content
                })
        
        return relationships
    
    def _build_temporal_order(self, claims: List[StructuredClaim]) -> List[str]:
        """Build temporal ordering of claims"""
        temporal_claims = []
        
        for claim in claims:
            if claim.temporal_scope:
                temporal_claims.append((claim.claim_id, claim.temporal_scope))
        
        # Sort by temporal scope (simple sorting for now)
        temporal_claims.sort(key=lambda x: x[1])
        
        return [claim_id for claim_id, _ in temporal_claims]
    
    def _build_hierarchy(self, claims: List[StructuredClaim]) -> Dict[str, List[str]]:
        """Build hierarchical structure of claims"""
        hierarchy = defaultdict(list)
        
        # Group claims by type
        claims_by_type = defaultdict(list)
        for claim in claims:
            claims_by_type[claim.claim_type].append(claim.claim_id)
        
        # Build simple hierarchy
        for claim_type, claim_ids in claims_by_type.items():
            hierarchy[claim_type] = claim_ids
        
        return dict(hierarchy)

class DeterministicAnalysisEngine:
    """Main deterministic analysis engine"""
    
    def __init__(self):
        self.knowledge_extractor = StructuredKnowledgeExtractor()
    
    def analyze_document(self, segments: List[Dict]) -> Dict[str, Any]:
        """Perform thorough deterministic analysis"""
        
        print(f"🔍 Starting deterministic analysis of {len(segments)} segments")
        
        # Extract structured knowledge
        knowledge_graph = self.knowledge_extractor.extract_structured_knowledge(segments)
        
        # Validate all claims have proper citations
        validated_claims = self._validate_claims(knowledge_graph.claims, segments)
        
        # Generate structured summary
        structured_summary = self._generate_structured_summary(knowledge_graph)
        
        return {
            "knowledge_graph": knowledge_graph,
            "validated_claims": validated_claims,
            "structured_summary": structured_summary,
            "analysis_metadata": {
                "total_claims": len(validated_claims),
                "claim_types": list(set(claim.claim_type for claim in validated_claims)),
                "entities_found": len(knowledge_graph.entities),
                "relationships_found": len(knowledge_graph.relationships)
            }
        }
    
    def _validate_claims(self, claims: List[StructuredClaim], segments: List[Dict]) -> List[StructuredClaim]:
        """Validate all claims have proper citations and evidence"""
        
        # Build citation lookup
        citation_lookup = {}
        for segment in segments:
            ref = segment['segment']['reference']
            citation_lookup[ref] = segment['segment']['content']
        
        validated_claims = []
        
        for claim in claims:
            # Verify citations exist
            valid_citations = []
            for citation in claim.citations:
                if citation in citation_lookup:
                    valid_citations.append(citation)
                else:
                    print(f"Warning: Citation {citation} not found for claim {claim.claim_id}")
            
            if valid_citations:
                claim.citations = valid_citations
                validated_claims.append(claim)
            else:
                print(f"Dropping claim {claim.claim_id} - no valid citations")
        
        return validated_claims
    
    def _generate_structured_summary(self, kg: KnowledgeGraph) -> str:
        """Generate structured summary from knowledge graph"""
        
        if not kg.claims:
            return "No structured claims could be extracted from this document."
        
        # Group claims by type
        claims_by_type = defaultdict(list)
        for claim in kg.claims:
            claims_by_type[claim.claim_type].append(claim)
        
        summary_parts = ["# Structured Document Analysis\n"]
        
        # Add claims by type in logical order
        claim_order = ["definition", "statement", "obligation", "permission", "prohibition", "conditional", "conclusion"]
        
        for claim_type in claim_order:
            if claim_type in claims_by_type and claims_by_type[claim_type]:
                claims = claims_by_type[claim_type]
                summary_parts.append(f"## {claim_type.title()} Claims")
                
                for claim in claims:
                    # Format citations properly for frontend parsing
                    citations_str = ", ".join(f"[{cit}]" for cit in claim.citations)
                    
                    claim_text = f"**{claim.subject}** {claim.predicate}"
                    if claim.object:
                        claim_text += f" {claim.object}"
                    
                    if claim.conditions:
                        claim_text += f" (Conditions: {'; '.join(claim.conditions)})"
                    
                    if claim.temporal_scope:
                        claim_text += f" (Timeline: {claim.temporal_scope})"
                    
                    if claim.quantifiers:
                        claim_text += f" (Quantities: {'; '.join(claim.quantifiers)})"
                    
                    claim_text += f" {citations_str}"
                    
                    summary_parts.append(f"- {claim_text}")
                    summary_parts.append("")
        
        # Add any remaining claim types not in the ordered list
        for claim_type, claims in claims_by_type.items():
            if claim_type not in claim_order and claims:
                summary_parts.append(f"## {claim_type.title()} Claims")
                
                for claim in claims:
                    citations_str = ", ".join(f"[{cit}]" for cit in claim.citations)
                    claim_text = f"**{claim.subject}** {claim.predicate}"
                    if claim.object:
                        claim_text += f" {claim.object}"
                    claim_text += f" {citations_str}"
                    summary_parts.append(f"- {claim_text}")
                    summary_parts.append("")
        
        # Add entity information
        if kg.entities:
            summary_parts.append("## Key Entities")
            for entity_id, entity_data in list(kg.entities.items())[:10]:  # Limit to top 10
                citation = entity_data.get('citation', 'unknown')
                summary_parts.append(f"- **{entity_data['text']}** ({entity_data.get('label', 'ENTITY')}) [{citation}]")
            summary_parts.append("")
        
        return "\n".join(summary_parts)