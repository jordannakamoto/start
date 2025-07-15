"""Standalone test for the search system without FastAPI dependencies."""

from search_datastore import SearchDataStore, TextSegment
from background_processors import (
    KeywordExtractionNode, 
    EntityRecognitionNode, 
    ProximityGraphBuilderNode,
    IndexOptimizationFlow
)
import asyncio
import hashlib

async def test_search_system():
    # Initialize datastore
    datastore = SearchDataStore()
    
    # Create sample segments
    sample_segments = [
        TextSegment(
            id=hashlib.md5(f"test:1:1:1".encode()).hexdigest(),
            content="Machine learning algorithms are transforming how we process and understand data.",
            page=1, paragraph=1, sentence=1, char_start=0, char_end=80
        ),
        TextSegment(
            id=hashlib.md5(f"test:1:2:1".encode()).hexdigest(),
            content="Deep learning is a subset of machine learning that uses neural networks.",
            page=1, paragraph=2, sentence=1, char_start=81, char_end=152
        ),
        TextSegment(
            id=hashlib.md5(f"test:2:1:1".encode()).hexdigest(),
            content="Natural language processing enables computers to understand human language.",
            page=2, paragraph=1, sentence=1, char_start=153, char_end=227
        ),
        TextSegment(
            id=hashlib.md5(f"test:2:1:2".encode()).hexdigest(),
            content="Modern NLP systems use transformer architectures like BERT and GPT.",
            page=2, paragraph=1, sentence=2, char_start=228, char_end=295
        )
    ]
    
    # Test basic indexing
    print("=== Testing Basic Indexing ===")
    cache = datastore.create_or_update_index("test_pdf", sample_segments)
    print(f"Indexed {len(sample_segments)} segments")
    print(f"Index contains {len(cache.semantic_index.inverted_index)} unique words")
    
    # Test exact search
    print("\n=== Testing Exact Search ===")
    results = datastore.search("test_pdf", "machine learning", "exact")
    print(f"Query: 'machine learning'")
    print(f"Found {len(results)} results:")
    for r in results:
        print(f"  - {r.get_reference()}: {r.content[:50]}...")
    
    # Test proximity search
    print("\n=== Testing Proximity Search ===")
    results = datastore.search("test_pdf", "learning algorithms", "proximity")
    print(f"Query: 'learning algorithms'")
    print(f"Found {len(results)} results:")
    for r in results:
        print(f"  - {r.get_reference()}: {r.content[:50]}...")
    
    # Test keyword extraction
    print("\n=== Testing Keyword Extraction ===")
    keyword_node = KeywordExtractionNode()
    shared_context = {'segments': sample_segments}
    await keyword_node.run_async(shared_context)
    enhanced_segments = shared_context
    
    for seg in enhanced_segments['keyword_extracted_segments'][:2]:
        print(f"Segment {seg.get_reference()} keywords: {seg.keywords}")
    
    # Test entity recognition
    print("\n=== Testing Entity Recognition ===")
    entity_node = EntityRecognitionNode()
    await entity_node.run_async(shared_context)
    
    for seg in shared_context['entity_recognized_segments']:
        if seg.entities:
            print(f"Segment {seg.get_reference()} entities:")
            for entity in seg.entities:
                print(f"  - {entity['type']}: {entity['value']}")
    
    # Update index with enhanced segments
    cache = datastore.create_or_update_index("test_pdf", shared_context['entity_recognized_segments'])
    
    # Test suggestions
    print("\n=== Testing Search Suggestions ===")
    suggestions = datastore.get_search_suggestions("test_pdf", "mach")
    print(f"Suggestions for 'mach': {suggestions}")
    
    # Test navigation map
    print("\n=== Testing Navigation Map ===")
    nav_map = datastore.get_navigation_map("test_pdf")
    for page, paragraphs in nav_map.items():
        print(f"Page {page}:")
        for para, sentences in paragraphs.items():
            print(f"  Paragraph {para}: {len(sentences)} sentences")
    
    # Test proximity graph building
    print("\n=== Testing Proximity Graph ===")
    proximity_node = ProximityGraphBuilderNode()
    shared_context['search_store'] = datastore
    await proximity_node.run_async(shared_context)
    
    # Check proximity relationships
    first_segment_id = sample_segments[0].id
    if first_segment_id in cache.semantic_index.proximity_graph:
        nearby = cache.semantic_index.proximity_graph[first_segment_id]
        print(f"Proximity graph for first segment:")
        for seg_id, score in nearby[:3]:
            if seg_id in cache.semantic_index.segments:
                seg = cache.semantic_index.segments[seg_id]
                print(f"  - {seg.get_reference()} (score: {score:.2f})")
    
    # Test search with different types
    print("\n=== Testing Different Search Types ===")
    search_types = ["exact", "proximity", "hybrid"]
    query = "language processing"
    
    for search_type in search_types:
        results = datastore.search("test_pdf", query, search_type)
        print(f"{search_type.capitalize()} search for '{query}': {len(results)} results")
    
    # Show search statistics
    print("\n=== Search Statistics ===")
    print(f"Total searches performed: {datastore.global_metrics['total_searches']}")
    print(f"Popular queries: {dict(datastore.global_metrics['popular_queries'])}")
    
    return datastore

if __name__ == "__main__":
    print("Starting search system test...\n")
    datastore = asyncio.run(test_search_system())
    print("\nTest completed successfully!")