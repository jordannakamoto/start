"""
Robust Citation System for PDF Analysis

This module provides a deterministic, scalable citation system with:
- Precise character-level addressing
- Hierarchical document structure
- Deterministic segmentation
- Fast lookup and resolution
- Validation and integrity checks
"""

from typing import Dict, List, Set, Tuple, Optional, Any, NamedTuple
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import json
from enum import Enum
import re
from collections import defaultdict

class SegmentType(Enum):
    """Types of text segments for granular citation"""
    DOCUMENT = "doc"
    PAGE = "page" 
    SECTION = "section"
    PARAGRAPH = "para"
    SENTENCE = "sent"
    PHRASE = "phrase"
    WORD = "word"
    CHARACTER = "char"

@dataclass
class DocumentAddress:
    """Hierarchical address for any text segment"""
    document_id: str
    page: int
    section: Optional[int] = None
    paragraph: int = 0
    sentence: int = 0
    phrase: int = 0
    char_start: int = 0
    char_end: int = 0
    
    def to_reference(self, precision: SegmentType = SegmentType.SENTENCE) -> str:
        """Generate citation reference at specified precision level"""
        ref = f"doc:{self.document_id}:p{self.page}"
        
        if precision.value in ["section", "para", "sent", "phrase", "word", "char"] and self.section is not None:
            ref += f".sec{self.section}"
            
        if precision.value in ["para", "sent", "phrase", "word", "char"]:
            ref += f".para{self.paragraph}"
            
        if precision.value in ["sent", "phrase", "word", "char"]:
            ref += f".sent{self.sentence}"
            
        if precision.value in ["phrase", "word", "char"]:
            ref += f".phrase{self.phrase}"
            
        if precision.value in ["char"]:
            ref += f".char{self.char_start}-{self.char_end}"
            
        return ref
    
    @classmethod
    def from_reference(cls, reference: str) -> 'DocumentAddress':
        """Parse citation reference back to address"""
        parts = reference.split(':')
        if len(parts) < 3 or parts[0] != 'doc':
            raise ValueError(f"Invalid reference format: {reference}")
            
        doc_id = parts[1]
        location_parts = parts[2].split('.')
        
        address = cls(document_id=doc_id, page=0)
        
        for part in location_parts:
            if part.startswith('p'):
                address.page = int(part[1:])
            elif part.startswith('sec'):
                address.section = int(part[3:])
            elif part.startswith('para'):
                address.paragraph = int(part[4:])
            elif part.startswith('sent'):
                address.sentence = int(part[4:])
            elif part.startswith('phrase'):
                address.phrase = int(part[6:])
            elif part.startswith('char'):
                char_range = part[4:].split('-')
                address.char_start = int(char_range[0])
                address.char_end = int(char_range[1]) if len(char_range) > 1 else address.char_start
                
        return address

@dataclass
class TextSegment:
    """Immutable text segment with precise addressing"""
    address: DocumentAddress
    content: str
    segment_type: SegmentType
    content_hash: str = field(init=False)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        self.content_hash = hashlib.sha256(self.content.encode()).hexdigest()[:16]
    
    @property
    def id(self) -> str:
        """Unique segment identifier"""
        return f"{self.address.to_reference(SegmentType.CHARACTER)}#{self.content_hash}"
    
    def get_reference(self, precision: SegmentType = SegmentType.SENTENCE) -> str:
        """Get citation reference at specified precision"""
        return self.address.to_reference(precision)

class DeterministicSegmenter:
    """Deterministic text segmentation with consistent results"""
    
    def __init__(self):
        # Compile regex patterns for performance
        self.sentence_pattern = re.compile(
            r'(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*\n+\s*(?=[A-Z])',
            re.MULTILINE
        )
        self.paragraph_pattern = re.compile(r'\n\s*\n+', re.MULTILINE)
        self.section_pattern = re.compile(r'\n\s*(?=\d+\.|\w+\.|\b[A-Z][A-Z\s]+\b)', re.MULTILINE)
        
    def segment_document(self, document_id: str, pages: Dict[int, str]) -> List[TextSegment]:
        """Segment entire document into hierarchical segments"""
        segments = []
        
        for page_num, page_content in sorted(pages.items()):
            page_segments = self._segment_page(document_id, page_num, page_content)
            segments.extend(page_segments)
            
        return segments
    
    def _segment_page(self, document_id: str, page_num: int, content: str) -> List[TextSegment]:
        """Segment a single page"""
        segments = []
        content = content.strip()
        
        # Page-level segment
        page_address = DocumentAddress(
            document_id=document_id,
            page=page_num,
            char_start=0,
            char_end=len(content)
        )
        segments.append(TextSegment(page_address, content, SegmentType.PAGE))
        
        # Split into sections (if detected)
        sections = self._split_sections(content)
        
        for sec_idx, section_content in enumerate(sections):
            section_address = DocumentAddress(
                document_id=document_id,
                page=page_num,
                section=sec_idx if len(sections) > 1 else None
            )
            
            # Segment paragraphs within section
            section_segments = self._segment_paragraphs(
                section_address, section_content
            )
            segments.extend(section_segments)
            
        return segments
    
    def _split_sections(self, content: str) -> List[str]:
        """Split content into sections if clear section markers exist"""
        # Look for numbered sections, headers, etc.
        potential_splits = self.section_pattern.split(content)
        
        # Only split if we find clear section boundaries
        if len(potential_splits) > 1 and all(len(s.strip()) > 50 for s in potential_splits):
            return [s.strip() for s in potential_splits if s.strip()]
        
        return [content]  # No clear sections found
    
    def _segment_paragraphs(self, base_address: DocumentAddress, content: str) -> List[TextSegment]:
        """Segment content into paragraphs and sentences"""
        segments = []
        
        # Split into paragraphs
        paragraphs = self.paragraph_pattern.split(content)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        char_offset = 0
        
        for para_idx, paragraph in enumerate(paragraphs):
            # Paragraph segment
            para_address = DocumentAddress(
                document_id=base_address.document_id,
                page=base_address.page,
                section=base_address.section,
                paragraph=para_idx,
                char_start=char_offset,
                char_end=char_offset + len(paragraph)
            )
            segments.append(TextSegment(para_address, paragraph, SegmentType.PARAGRAPH))
            
            # Segment sentences within paragraph
            sentence_segments = self._segment_sentences(para_address, paragraph)
            segments.extend(sentence_segments)
            
            char_offset += len(paragraph) + 2  # Account for paragraph breaks
            
        return segments
    
    def _segment_sentences(self, para_address: DocumentAddress, paragraph: str) -> List[TextSegment]:
        """Segment paragraph into sentences"""
        segments = []
        
        # Split into sentences
        sentences = self.sentence_pattern.split(paragraph)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        char_offset = 0
        
        for sent_idx, sentence in enumerate(sentences):
            if len(sentence) < 10:  # Skip very short sentences
                char_offset += len(sentence) + 1
                continue
                
            sent_address = DocumentAddress(
                document_id=para_address.document_id,
                page=para_address.page,
                section=para_address.section,
                paragraph=para_address.paragraph,
                sentence=sent_idx,
                char_start=para_address.char_start + char_offset,
                char_end=para_address.char_start + char_offset + len(sentence)
            )
            segments.append(TextSegment(sent_address, sentence, SegmentType.SENTENCE))
            
            char_offset += len(sentence) + 1  # Account for sentence break
            
        return segments

class CitationIndex:
    """High-performance citation lookup and resolution"""
    
    def __init__(self):
        self.segments: Dict[str, TextSegment] = {}
        self.address_index: Dict[str, str] = {}  # reference -> segment_id
        self.content_index: Dict[str, Set[str]] = defaultdict(set)  # content_hash -> segment_ids
        self.hierarchy_index: Dict[str, List[str]] = defaultdict(list)  # parent_ref -> child_refs
        
    def add_segments(self, segments: List[TextSegment]):
        """Add segments to index with validation"""
        for segment in segments:
            self._add_segment(segment)
            
    def _add_segment(self, segment: TextSegment):
        """Add single segment with hierarchy tracking"""
        self.segments[segment.id] = segment
        
        # Index by various reference formats
        for precision in SegmentType:
            ref = segment.get_reference(precision)
            if ref not in self.address_index:
                self.address_index[ref] = segment.id
                
        # Content deduplication index
        self.content_index[segment.content_hash].add(segment.id)
        
        # Build hierarchy relationships
        self._build_hierarchy(segment)
        
    def _build_hierarchy(self, segment: TextSegment):
        """Build parent-child relationships"""
        addr = segment.address
        
        # Build hierarchy from document down to this segment
        refs = []
        
        # Document level
        doc_ref = f"doc:{addr.document_id}"
        refs.append(doc_ref)
        
        # Page level
        page_ref = f"doc:{addr.document_id}:p{addr.page}"
        refs.append(page_ref)
        
        # Section level (if exists)
        if addr.section is not None:
            section_ref = f"doc:{addr.document_id}:p{addr.page}.sec{addr.section}"
            refs.append(section_ref)
            
        # Paragraph level
        para_ref = segment.get_reference(SegmentType.PARAGRAPH)
        refs.append(para_ref)
        
        # Sentence level
        if segment.segment_type in [SegmentType.SENTENCE, SegmentType.PHRASE, SegmentType.WORD]:
            sent_ref = segment.get_reference(SegmentType.SENTENCE)
            refs.append(sent_ref)
            
        # Build parent -> children relationships
        for i in range(len(refs) - 1):
            parent_ref = refs[i]
            child_ref = refs[i + 1]
            if child_ref not in self.hierarchy_index[parent_ref]:
                self.hierarchy_index[parent_ref].append(child_ref)
    
    def resolve_citation(self, reference: str) -> Optional[TextSegment]:
        """Resolve citation reference to segment"""
        segment_id = self.address_index.get(reference)
        return self.segments.get(segment_id) if segment_id else None
    
    def get_context(self, reference: str, context_type: str = "paragraph") -> Dict[str, Any]:
        """Get contextual information around a citation"""
        segment = self.resolve_citation(reference)
        if not segment:
            return {}
            
        context = {
            "segment": segment,
            "reference": reference,
            "content": segment.content,
            "address": segment.address,
            "type": segment.segment_type.value
        }
        
        # Add hierarchical context
        if context_type == "paragraph":
            para_ref = segment.get_reference(SegmentType.PARAGRAPH)
            para_segment = self.resolve_citation(para_ref)
            if para_segment:
                context["paragraph"] = para_segment.content
                
        elif context_type == "page":
            page_ref = segment.get_reference(SegmentType.PAGE)
            page_segment = self.resolve_citation(page_ref)
            if page_segment:
                context["page"] = page_segment.content
                
        # Add surrounding sentences
        addr = segment.address
        surrounding = []
        for sent_offset in [-1, 0, 1]:
            sent_addr = DocumentAddress(
                document_id=addr.document_id,
                page=addr.page,
                section=addr.section,
                paragraph=addr.paragraph,
                sentence=addr.sentence + sent_offset
            )
            sent_ref = sent_addr.to_reference(SegmentType.SENTENCE)
            sent_segment = self.resolve_citation(sent_ref)
            if sent_segment:
                surrounding.append({
                    "offset": sent_offset,
                    "content": sent_segment.content,
                    "reference": sent_ref
                })
        
        context["surrounding"] = surrounding
        return context
    
    def validate_integrity(self) -> Dict[str, Any]:
        """Validate index integrity and return diagnostics"""
        diagnostics = {
            "total_segments": len(self.segments),
            "address_mappings": len(self.address_index),
            "content_duplicates": sum(1 for ids in self.content_index.values() if len(ids) > 1),
            "hierarchy_nodes": len(self.hierarchy_index),
            "issues": []
        }
        
        # Check for orphaned references
        for ref, segment_id in self.address_index.items():
            if segment_id not in self.segments:
                diagnostics["issues"].append(f"Orphaned reference: {ref} -> {segment_id}")
                
        # Check for duplicate content
        for content_hash, segment_ids in self.content_index.items():
            if len(segment_ids) > 1:
                segments = [self.segments[sid] for sid in segment_ids if sid in self.segments]
                if len(segments) > 1:
                    diagnostics["issues"].append(f"Duplicate content: {len(segments)} segments with hash {content_hash}")
                    
        return diagnostics

class CitationManager:
    """Main interface for citation system"""
    
    def __init__(self):
        self.segmenter = DeterministicSegmenter()
        self.index = CitationIndex()
        self.documents: Dict[str, Dict] = {}
        
    def process_document(self, document_id: str, pages: Dict[int, str], metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process document and build citation index"""
        
        # Store document metadata
        self.documents[document_id] = {
            "id": document_id,
            "pages": len(pages),
            "processed_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        # Segment document
        segments = self.segmenter.segment_document(document_id, pages)
        
        # Add to index
        self.index.add_segments(segments)
        
        # Return processing summary
        return {
            "document_id": document_id,
            "total_segments": len(segments),
            "segments_by_type": {
                stype.value: len([s for s in segments if s.segment_type == stype])
                for stype in SegmentType
            },
            "index_integrity": self.index.validate_integrity()
        }
    
    def cite(self, reference: str, context_type: str = "sentence") -> Dict[str, Any]:
        """Get citation with full context"""
        return self.index.get_context(reference, context_type)
    
    def search_citations(self, query: str, document_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for citations containing query text"""
        results = []
        
        for segment in self.index.segments.values():
            if document_id and segment.address.document_id != document_id:
                continue
                
            if query.lower() in segment.content.lower():
                results.append({
                    "reference": segment.get_reference(),
                    "content": segment.content,
                    "address": segment.address,
                    "relevance": self._calculate_relevance(query, segment.content)
                })
                
        # Sort by relevance
        results.sort(key=lambda x: x["relevance"], reverse=True)
        return results
    
    def _calculate_relevance(self, query: str, content: str) -> float:
        """Simple relevance scoring"""
        query_lower = query.lower()
        content_lower = content.lower()
        
        # Exact match gets highest score
        if query_lower == content_lower:
            return 1.0
            
        # Count matches
        matches = content_lower.count(query_lower)
        if matches == 0:
            return 0.0
            
        # Score based on match density and position
        match_density = matches / len(content_lower.split())
        position_bonus = 0.1 if content_lower.startswith(query_lower) else 0.0
        
        return min(1.0, match_density + position_bonus)
    
    def export_index(self) -> Dict[str, Any]:
        """Export citation index for persistence"""
        return {
            "documents": self.documents,
            "segments": {
                sid: {
                    "address": {
                        "document_id": s.address.document_id,
                        "page": s.address.page,
                        "section": s.address.section,
                        "paragraph": s.address.paragraph,
                        "sentence": s.address.sentence,
                        "phrase": s.address.phrase,
                        "char_start": s.address.char_start,
                        "char_end": s.address.char_end
                    },
                    "content": s.content,
                    "segment_type": s.segment_type.value,
                    "content_hash": s.content_hash,
                    "metadata": s.metadata
                }
                for sid, s in self.index.segments.items()
            },
            "created_at": datetime.now().isoformat()
        }
    
    def import_index(self, data: Dict[str, Any]):
        """Import citation index from exported data"""
        self.documents = data.get("documents", {})
        
        # Reconstruct segments
        segments = []
        for sid, seg_data in data.get("segments", {}).items():
            addr_data = seg_data["address"]
            address = DocumentAddress(
                document_id=addr_data["document_id"],
                page=addr_data["page"],
                section=addr_data.get("section"),
                paragraph=addr_data["paragraph"],
                sentence=addr_data["sentence"],
                phrase=addr_data["phrase"],
                char_start=addr_data["char_start"],
                char_end=addr_data["char_end"]
            )
            
            segment = TextSegment(
                address=address,
                content=seg_data["content"],
                segment_type=SegmentType(seg_data["segment_type"]),
                metadata=seg_data.get("metadata", {})
            )
            segments.append(segment)
            
        # Rebuild index
        self.index = CitationIndex()
        self.index.add_segments(segments)