from typing import Dict, List, Set, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
from collections import defaultdict

@dataclass
class TextSegment:
    id: str
    content: str
    page: int
    paragraph: int
    sentence: int
    char_start: int
    char_end: int
    embeddings: Optional[List[float]] = None
    keywords: Set[str] = field(default_factory=set)
    entities: List[Dict[str, str]] = field(default_factory=list)
    
    def get_reference(self) -> str:
        return f"p{self.page}.para{self.paragraph}.s{self.sentence}"

@dataclass
class SemanticIndex:
    segments: Dict[str, TextSegment] = field(default_factory=dict)
    inverted_index: Dict[str, Set[str]] = field(default_factory=lambda: defaultdict(set))
    position_index: Dict[Tuple[int, int, int], str] = field(default_factory=dict)
    entity_index: Dict[str, Set[str]] = field(default_factory=lambda: defaultdict(set))
    proximity_graph: Dict[str, List[Tuple[str, float]]] = field(default_factory=lambda: defaultdict(list))
    
    def add_segment(self, segment: TextSegment):
        self.segments[segment.id] = segment
        self.position_index[(segment.page, segment.paragraph, segment.sentence)] = segment.id
        
        words = segment.content.lower().split()
        for word in words:
            self.inverted_index[word].add(segment.id)
        
        for entity in segment.entities:
            self.entity_index[entity['type']].add(segment.id)
    
    def deterministic_search(self, query: str, search_type: str = "exact") -> List[TextSegment]:
        query_hash = hashlib.md5(f"{query}:{search_type}".encode()).hexdigest()
        
        if search_type == "exact":
            return self._exact_search(query)
        elif search_type == "semantic":
            return self._semantic_search(query)
        elif search_type == "proximity":
            return self._proximity_search(query)
        elif search_type == "entity":
            return self._entity_search(query)
        else:
            return self._hybrid_search(query)
    
    def _exact_search(self, query: str) -> List[TextSegment]:
        query_words = set(query.lower().split())
        matching_segments = set()
        
        for word in query_words:
            matching_segments.update(self.inverted_index.get(word, set()))
        
        results = [self.segments[seg_id] for seg_id in matching_segments]
        return sorted(results, key=lambda s: (s.page, s.paragraph, s.sentence))
    
    def _semantic_search(self, query: str) -> List[TextSegment]:
        return []
    
    def _proximity_search(self, query: str) -> List[TextSegment]:
        words = query.lower().split()
        if len(words) < 2:
            return self._exact_search(query)
        
        candidate_segments = None
        for word in words:
            word_segments = self.inverted_index.get(word, set())
            if candidate_segments is None:
                candidate_segments = word_segments
            else:
                candidate_segments = candidate_segments.intersection(word_segments)
        
        results = []
        for seg_id in candidate_segments:
            segment = self.segments[seg_id]
            if self._check_proximity(segment.content.lower(), words):
                results.append(segment)
        
        return sorted(results, key=lambda s: (s.page, s.paragraph, s.sentence))
    
    def _check_proximity(self, text: str, words: List[str], max_distance: int = 10) -> bool:
        positions = []
        text_words = text.split()
        
        for word in words:
            word_positions = [i for i, w in enumerate(text_words) if w == word]
            if not word_positions:
                return False
            positions.append(word_positions)
        
        for i in range(len(positions) - 1):
            found_close = False
            for pos1 in positions[i]:
                for pos2 in positions[i + 1]:
                    if abs(pos1 - pos2) <= max_distance:
                        found_close = True
                        break
                if found_close:
                    break
            if not found_close:
                return False
        
        return True
    
    def _entity_search(self, entity_type: str) -> List[TextSegment]:
        segment_ids = self.entity_index.get(entity_type, set())
        results = [self.segments[seg_id] for seg_id in segment_ids]
        return sorted(results, key=lambda s: (s.page, s.paragraph, s.sentence))
    
    def _hybrid_search(self, query: str) -> List[TextSegment]:
        exact_results = set(s.id for s in self._exact_search(query))
        proximity_results = set(s.id for s in self._proximity_search(query))
        
        combined = exact_results.union(proximity_results)
        results = [self.segments[seg_id] for seg_id in combined]
        
        return sorted(results, key=lambda s: (s.page, s.paragraph, s.sentence))

@dataclass
class PDFSearchCache:
    pdf_id: str
    semantic_index: SemanticIndex
    last_updated: datetime
    access_count: int = 0
    search_history: List[Dict[str, Any]] = field(default_factory=list)
    optimization_metrics: Dict[str, float] = field(default_factory=dict)
    
    def record_search(self, query: str, search_type: str, results_count: int):
        self.access_count += 1
        self.search_history.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'type': search_type,
            'results': results_count
        })

class SearchDataStore:
    def __init__(self):
        self.pdf_caches: Dict[str, PDFSearchCache] = {}
        self.global_metrics: Dict[str, Any] = {
            'total_searches': 0,
            'popular_queries': defaultdict(int),
            'search_patterns': defaultdict(list)
        }
    
    def create_or_update_index(self, pdf_id: str, text_segments: List[TextSegment]) -> PDFSearchCache:
        if pdf_id in self.pdf_caches:
            cache = self.pdf_caches[pdf_id]
            cache.semantic_index = SemanticIndex()
        else:
            cache = PDFSearchCache(
                pdf_id=pdf_id,
                semantic_index=SemanticIndex(),
                last_updated=datetime.now()
            )
            self.pdf_caches[pdf_id] = cache
        
        for segment in text_segments:
            cache.semantic_index.add_segment(segment)
        
        cache.last_updated = datetime.now()
        return cache
    
    def search(self, pdf_id: str, query: str, search_type: str = "hybrid") -> List[TextSegment]:
        if pdf_id not in self.pdf_caches:
            return []
        
        cache = self.pdf_caches[pdf_id]
        results = cache.semantic_index.deterministic_search(query, search_type)
        
        cache.record_search(query, search_type, len(results))
        self.global_metrics['total_searches'] += 1
        self.global_metrics['popular_queries'][query] += 1
        
        return results
    
    def get_search_suggestions(self, pdf_id: str, partial_query: str) -> List[str]:
        if pdf_id not in self.pdf_caches:
            return []
        
        cache = self.pdf_caches[pdf_id]
        suggestions = []
        
        for word in cache.semantic_index.inverted_index.keys():
            if word.startswith(partial_query.lower()):
                suggestions.append(word)
        
        return sorted(suggestions)[:10]
    
    def get_navigation_map(self, pdf_id: str) -> Dict[str, Any]:
        if pdf_id not in self.pdf_caches:
            return {}
        
        cache = self.pdf_caches[pdf_id]
        nav_map = defaultdict(lambda: defaultdict(list))
        
        for segment in cache.semantic_index.segments.values():
            nav_map[segment.page][segment.paragraph].append({
                'sentence': segment.sentence,
                'preview': segment.content[:50] + '...' if len(segment.content) > 50 else segment.content,
                'entities': segment.entities,
                'keywords': list(segment.keywords)
            })
        
        return dict(nav_map)
    
    def optimize_index(self, pdf_id: str):
        if pdf_id not in self.pdf_caches:
            return
        
        cache = self.pdf_caches[pdf_id]
        
        frequent_queries = [q for q, count in self.global_metrics['popular_queries'].items() if count > 5]
        for query in frequent_queries:
            results = cache.semantic_index.deterministic_search(query, "hybrid")
            if results:
                for i, segment in enumerate(results[:5]):
                    for j, other_segment in enumerate(results[i+1:i+6]):
                        similarity = self._calculate_similarity(segment, other_segment)
                        cache.semantic_index.proximity_graph[segment.id].append((other_segment.id, similarity))
        
        cache.optimization_metrics['last_optimized'] = datetime.now().isoformat()
        cache.optimization_metrics['indexed_queries'] = len(frequent_queries)
    
    def _calculate_similarity(self, seg1: TextSegment, seg2: TextSegment) -> float:
        words1 = set(seg1.content.lower().split())
        words2 = set(seg2.content.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        return intersection / union if union > 0 else 0.0