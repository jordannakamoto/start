from pocketflow import AsyncFlow, AsyncNode
from test_pdf_summary import PDFParseNode, CitationExtractionNode, KeyPointsExtractionNode, SummaryGenerationNode
from background_processors import KeywordExtractionNode, EntityRecognitionNode, ProximityGraphBuilderNode
from search_datastore import SearchDataStore, TextSegment
from search_api import search_store
import hashlib
from typing import Dict, List
import asyncio

class PDFToSearchIndexNode(AsyncNode):
    """Convert parsed PDF data to search index segments."""
    
    async def prep_async(self, shared):
        return {
            'citations': shared.get('citations', []),
            'pdf_id': shared.get('pdf_id', 'default_pdf')
        }
    
    async def exec_async(self, data):
        segments = []
        
        for citation in data['citations']:
            segment = TextSegment(
                id=hashlib.md5(f"{data['pdf_id']}:{citation['page']}:{citation['paragraph']}:{citation['sentence']}".encode()).hexdigest(),
                content=citation['text'],
                page=citation['page'],
                paragraph=citation['paragraph'],
                sentence=citation['sentence'],
                char_start=0,
                char_end=len(citation['text'])
            )
            segments.append(segment)
        
        return segments
    
    async def post_async(self, shared, prep_res, exec_res):
        shared['search_segments'] = exec_res
        return None

class IndexCreationNode(AsyncNode):
    """Create search index in the datastore."""
    
    def __init__(self, datastore: SearchDataStore):
        super().__init__()
        self.datastore = datastore
    
    async def prep_async(self, shared):
        return {
            'segments': shared.get('search_segments', []),
            'pdf_id': shared.get('pdf_id', 'default_pdf')
        }
    
    async def exec_async(self, data):
        if not data['segments']:
            return None
        
        cache = self.datastore.create_or_update_index(data['pdf_id'], data['segments'])
        
        return {
            'pdf_id': data['pdf_id'],
            'segments_indexed': len(data['segments']),
            'cache_created': cache.last_updated
        }
    
    async def post_async(self, shared, prep_res, exec_res):
        shared['index_result'] = exec_res
        return None

class SmartSearchNode(AsyncNode):
    """Perform intelligent search with context awareness."""
    
    def __init__(self, datastore: SearchDataStore):
        super().__init__()
        self.datastore = datastore
    
    async def prep_async(self, shared):
        return {
            'pdf_id': shared.get('pdf_id', 'default_pdf'),
            'query': shared.get('search_query', ''),
            'search_type': shared.get('search_type', 'hybrid')
        }
    
    async def exec_async(self, data):
        if not data['query']:
            return []
        
        results = self.datastore.search(data['pdf_id'], data['query'], data['search_type'])
        
        enriched_results = []
        for segment in results[:10]:
            proximity_segments = []
            if segment.id in self.datastore.pdf_caches[data['pdf_id']].semantic_index.proximity_graph:
                for prox_id, score in self.datastore.pdf_caches[data['pdf_id']].semantic_index.proximity_graph[segment.id]:
                    if prox_id in self.datastore.pdf_caches[data['pdf_id']].semantic_index.segments:
                        prox_seg = self.datastore.pdf_caches[data['pdf_id']].semantic_index.segments[prox_id]
                        proximity_segments.append({
                            'reference': prox_seg.get_reference(),
                            'preview': prox_seg.content[:50] + '...',
                            'score': score
                        })
            
            enriched_results.append({
                'segment': {
                    'id': segment.id,
                    'content': segment.content,
                    'reference': segment.get_reference(),
                    'page': segment.page,
                    'keywords': list(segment.keywords),
                    'entities': segment.entities
                },
                'context': {
                    'nearby_segments': proximity_segments[:3]
                }
            })
        
        return enriched_results
    
    async def post_async(self, shared, prep_res, exec_res):
        shared['search_results'] = exec_res
        return exec_res

class IntegratedPDFProcessingFlow(AsyncFlow):
    """Complete flow from PDF parsing to searchable index with smart features."""
    
    def __init__(self, datastore: SearchDataStore = None):
        super().__init__()
        self.datastore = datastore or search_store
        
        parse_node = PDFParseNode()
        citation_node = CitationExtractionNode()
        keypoints_node = KeyPointsExtractionNode()
        summary_node = SummaryGenerationNode()
        
        pdf_to_index_node = PDFToSearchIndexNode()
        keyword_node = KeywordExtractionNode()
        entity_node = EntityRecognitionNode()
        index_creation_node = IndexCreationNode(self.datastore)
        proximity_node = ProximityGraphBuilderNode()
        
        self.start(parse_node)
        
        parse_node >> citation_node >> keypoints_node >> summary_node
        citation_node >> pdf_to_index_node >> keyword_node >> entity_node >> index_creation_node >> proximity_node
    
    async def post_async(self, shared, prep_res, exec_res):
        return {
            'summary': shared.get('summary', ''),
            'index_result': shared.get('index_result', {}),
            'total_citations': len(shared.get('citations', [])),
            'key_points': len(shared.get('key_points', []))
        }

async def process_pdf_with_search(pdf_data: Dict[int, str], pdf_id: str = None):
    """Process PDF and create searchable index."""
    pdf_id = pdf_id or hashlib.md5(str(sorted(pdf_data.items())).encode()).hexdigest()[:16]
    
    shared_context = {
        'pdf_pages': pdf_data,
        'pdf_id': pdf_id,
        'search_store': search_store
    }
    
    flow = IntegratedPDFProcessingFlow(search_store)
    result = await flow.run_async(shared_context)
    
    return {
        'pdf_id': pdf_id,
        'processing_result': result,
        'search_enabled': True
    }

async def search_processed_pdf(pdf_id: str, query: str, search_type: str = "hybrid"):
    """Search in a processed PDF."""
    shared_context = {
        'pdf_id': pdf_id,
        'search_query': query,
        'search_type': search_type
    }
    
    search_node = SmartSearchNode(search_store)
    results = await search_node.run_async(shared_context)
    
    return shared_context.get('search_results', [])

async def test_integrated_flow():
    """Test the integrated PDF processing and search flow."""
    sample_pdf = {
        1: """Introduction to Advanced Search Systems

        Search systems have evolved significantly over the past decade. Modern implementations utilize sophisticated algorithms for text analysis and retrieval.

        The key components include indexing, ranking, and query processing. These work together to provide relevant results quickly.""",
        
        2: """Implementation Details

        Our search system uses deterministic algorithms to ensure consistent results. The system processes queries through multiple stages:
        
        1. Query parsing and analysis
        2. Index lookup and retrieval  
        3. Result ranking and filtering
        4. Context enrichment

        This approach ensures both speed and accuracy in search operations."""
    }
    
    print("Processing PDF and creating search index...")
    result = await process_pdf_with_search(sample_pdf, "test_pdf_001")
    print(f"Processing complete: {result}")
    
    print("\nTesting search functionality...")
    search_results = await search_processed_pdf("test_pdf_001", "search algorithms", "hybrid")
    
    for i, result in enumerate(search_results, 1):
        print(f"\nResult {i}:")
        print(f"  Reference: {result['segment']['reference']}")
        print(f"  Content: {result['segment']['content'][:100]}...")
        print(f"  Keywords: {result['segment']['keywords']}")
        if result['context']['nearby_segments']:
            print(f"  Related segments: {len(result['context']['nearby_segments'])}")

if __name__ == "__main__":
    asyncio.run(test_integrated_flow())