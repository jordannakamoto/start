from pocketflow import AsyncNode, AsyncFlow, AsyncBatchNode
from search_datastore import SearchDataStore, TextSegment
from typing import Dict, List, Set, Tuple
import asyncio
from datetime import datetime, timedelta
import re
from collections import Counter

class KeywordExtractionNode(AsyncNode):
    """Extract keywords from text segments using TF-IDF-like scoring."""
    
    async def prep_async(self, shared):
        return shared.get('segments', [])
    
    async def exec_async(self, segments: List[TextSegment]):
        stop_words = {'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'for', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'}
        
        document_freq = Counter()
        segment_words = []
        
        for segment in segments:
            words = set(w.lower() for w in re.findall(r'\b\w+\b', segment.content) if w.lower() not in stop_words and len(w) > 2)
            segment_words.append(words)
            document_freq.update(words)
        
        total_segments = len(segments)
        
        for i, segment in enumerate(segments):
            word_scores = {}
            words = segment_words[i]
            
            for word in words:
                tf = segment.content.lower().count(word) / len(segment.content.split())
                idf = 1.0 / (1 + document_freq[word] / total_segments)
                word_scores[word] = tf * idf
            
            top_keywords = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)[:5]
            segment.keywords = {word for word, _ in top_keywords}
        
        return segments
    
    async def post_async(self, shared, prep_res, exec_res):
        shared['keyword_extracted_segments'] = exec_res
        return None

class EntityRecognitionNode(AsyncNode):
    """Simple pattern-based entity recognition."""
    
    async def prep_async(self, shared):
        return shared.get('keyword_extracted_segments', [])
    
    async def exec_async(self, segments: List[TextSegment]):
        patterns = {
            'DATE': r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b',
            'NUMBER': r'\b\d+(?:\.\d+)?%?\b',
            'CAPS_TERM': r'\b[A-Z]{2,}\b',
            'TITLE': r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b',
            'EMAIL': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'URL': r'https?://[^\s]+',
        }
        
        for segment in segments:
            entities = []
            
            for entity_type, pattern in patterns.items():
                matches = re.findall(pattern, segment.content)
                for match in matches:
                    entities.append({
                        'type': entity_type,
                        'value': match,
                        'start': segment.content.find(match),
                        'end': segment.content.find(match) + len(match)
                    })
            
            segment.entities = sorted(entities, key=lambda x: x['start'])
        
        return segments
    
    async def post_async(self, shared, prep_res, exec_res):
        shared['entity_recognized_segments'] = exec_res
        return None

class ProximityGraphBuilderNode(AsyncNode):
    """Build proximity relationships between segments."""
    
    async def prep_async(self, shared):
        return {
            'segments': shared.get('entity_recognized_segments', []),
            'search_store': shared.get('search_store')
        }
    
    async def exec_async(self, data):
        segments = data['segments']
        search_store = data['search_store']
        
        if not search_store or not segments:
            return None
        
        segment_dict = {seg.id: seg for seg in segments}
        
        for i, segment in enumerate(segments):
            nearby_segments = []
            
            for j in range(max(0, i-5), min(len(segments), i+6)):
                if i != j:
                    other_seg = segments[j]
                    
                    if abs(segment.page - other_seg.page) <= 1:
                        distance = abs(j - i)
                        proximity_score = 1.0 / (1 + distance * 0.2)
                        
                        common_keywords = segment.keywords.intersection(other_seg.keywords)
                        if common_keywords:
                            proximity_score *= 1.5
                        
                        nearby_segments.append((other_seg.id, proximity_score))
            
            nearby_segments.sort(key=lambda x: x[1], reverse=True)
            
            for pdf_cache in search_store.pdf_caches.values():
                if segment.id in pdf_cache.semantic_index.segments:
                    pdf_cache.semantic_index.proximity_graph[segment.id] = nearby_segments[:5]
        
        return True
    
    async def post_async(self, shared, prep_res, exec_res):
        return None

class SearchPatternAnalyzerNode(AsyncNode):
    """Analyze search patterns to optimize future queries."""
    
    async def prep_async(self, shared):
        return shared.get('search_store')
    
    async def exec_async(self, search_store: SearchDataStore):
        if not search_store:
            return None
        
        pattern_insights = {
            'common_query_sequences': [],
            'co_occurring_terms': {},
            'time_based_patterns': {},
            'optimization_suggestions': []
        }
        
        all_queries = []
        for cache in search_store.pdf_caches.values():
            all_queries.extend(cache.search_history)
        
        all_queries.sort(key=lambda x: x['timestamp'])
        
        query_pairs = []
        for i in range(len(all_queries) - 1):
            if all_queries[i]['timestamp'][:10] == all_queries[i+1]['timestamp'][:10]:
                time_diff = (datetime.fromisoformat(all_queries[i+1]['timestamp']) - 
                           datetime.fromisoformat(all_queries[i]['timestamp'])).total_seconds()
                if time_diff < 300:
                    query_pairs.append((all_queries[i]['query'], all_queries[i+1]['query']))
        
        sequence_counter = Counter(query_pairs)
        pattern_insights['common_query_sequences'] = sequence_counter.most_common(10)
        
        all_query_terms = []
        for query_info in all_queries:
            all_query_terms.extend(query_info['query'].lower().split())
        
        term_counter = Counter(all_query_terms)
        common_terms = [term for term, count in term_counter.most_common(20)]
        
        co_occurrences = {}
        for term1 in common_terms:
            co_occurrences[term1] = {}
            for term2 in common_terms:
                if term1 != term2:
                    count = sum(1 for q in all_queries if term1 in q['query'].lower() and term2 in q['query'].lower())
                    if count > 0:
                        co_occurrences[term1][term2] = count
        
        pattern_insights['co_occurring_terms'] = co_occurrences
        
        for hour in range(24):
            hour_queries = [q for q in all_queries if int(q['timestamp'][11:13]) == hour]
            if hour_queries:
                pattern_insights['time_based_patterns'][f"{hour:02d}:00"] = len(hour_queries)
        
        if len(common_terms) > 10:
            pattern_insights['optimization_suggestions'].append(
                f"Consider pre-computing results for top terms: {', '.join(common_terms[:5])}"
            )
        
        if len(sequence_counter) > 5:
            pattern_insights['optimization_suggestions'].append(
                "Implement query sequence prediction for common patterns"
            )
        
        return pattern_insights
    
    async def post_async(self, shared, prep_res, exec_res):
        if exec_res:
            shared['pattern_insights'] = exec_res
        return exec_res

class IndexOptimizationFlow(AsyncFlow):
    """Background flow for optimizing search indices."""
    
    def __init__(self, search_store: SearchDataStore):
        super().__init__()
        self.search_store = search_store
        
        keyword_node = KeywordExtractionNode()
        entity_node = EntityRecognitionNode()
        proximity_node = ProximityGraphBuilderNode()
        pattern_node = SearchPatternAnalyzerNode()
        
        self.start(keyword_node)
        keyword_node >> entity_node >> proximity_node >> pattern_node
    
    async def prep_async(self, shared):
        shared['search_store'] = self.search_store
        
        all_segments = []
        for cache in self.search_store.pdf_caches.values():
            all_segments.extend(cache.semantic_index.segments.values())
        
        shared['segments'] = all_segments
        return all_segments

async def run_background_optimization(search_store: SearchDataStore):
    """Run optimization flow periodically."""
    flow = IndexOptimizationFlow(search_store)
    shared_context = {}
    
    while True:
        try:
            await flow.run_async(shared_context)
            
            if 'pattern_insights' in shared_context:
                print(f"Optimization completed at {datetime.now()}")
                print(f"Insights: {shared_context['pattern_insights']['optimization_suggestions']}")
            
            await asyncio.sleep(300)
            
        except Exception as e:
            print(f"Background optimization error: {e}")
            await asyncio.sleep(60)