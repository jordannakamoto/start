from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
from search_datastore import SearchDataStore, TextSegment, PDFSearchCache
import hashlib
import json

router = APIRouter(prefix="/api/search", tags=["search"])

search_store = SearchDataStore()

class SearchRequest(BaseModel):
    pdf_id: str
    query: str
    search_type: str = "hybrid"
    page_filter: Optional[int] = None
    limit: int = 50
    offset: int = 0

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_count: int
    search_id: str
    execution_time_ms: float

class IndexRequest(BaseModel):
    pdf_id: str
    segments: List[Dict[str, Any]]

class NavigationRequest(BaseModel):
    pdf_id: str
    page: Optional[int] = None

class SuggestionRequest(BaseModel):
    pdf_id: str
    partial_query: str

@router.post("/index")
async def create_search_index(request: IndexRequest, background_tasks: BackgroundTasks):
    """Create or update the search index for a PDF."""
    start_time = datetime.now()
    
    text_segments = []
    for seg_data in request.segments:
        segment = TextSegment(
            id=hashlib.md5(f"{request.pdf_id}:{seg_data['page']}:{seg_data['paragraph']}:{seg_data['sentence']}".encode()).hexdigest(),
            content=seg_data['content'],
            page=seg_data['page'],
            paragraph=seg_data['paragraph'],
            sentence=seg_data['sentence'],
            char_start=seg_data.get('char_start', 0),
            char_end=seg_data.get('char_end', len(seg_data['content'])),
            keywords=set(seg_data.get('keywords', [])),
            entities=seg_data.get('entities', [])
        )
        text_segments.append(segment)
    
    cache = search_store.create_or_update_index(request.pdf_id, text_segments)
    
    background_tasks.add_task(search_store.optimize_index, request.pdf_id)
    
    execution_time = (datetime.now() - start_time).total_seconds() * 1000
    
    return {
        "pdf_id": request.pdf_id,
        "segments_indexed": len(text_segments),
        "index_created": cache.last_updated.isoformat(),
        "execution_time_ms": execution_time
    }

@router.post("/query")
async def search_pdf(request: SearchRequest):
    """Execute a deterministic search on the PDF content."""
    start_time = datetime.now()
    
    search_id = hashlib.md5(f"{request.pdf_id}:{request.query}:{request.search_type}:{datetime.now().isoformat()}".encode()).hexdigest()[:16]
    
    try:
        results = search_store.search(request.pdf_id, request.query, request.search_type)
        
        if request.page_filter is not None:
            results = [r for r in results if r.page == request.page_filter]
        
        total_count = len(results)
        results = results[request.offset:request.offset + request.limit]
        
        formatted_results = []
        for segment in results:
            formatted_results.append({
                "id": segment.id,
                "content": segment.content,
                "reference": segment.get_reference(),
                "page": segment.page,
                "paragraph": segment.paragraph,
                "sentence": segment.sentence,
                "char_range": [segment.char_start, segment.char_end],
                "keywords": list(segment.keywords),
                "entities": segment.entities,
                "highlight_positions": _calculate_highlight_positions(segment.content, request.query)
            })
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return SearchResponse(
            results=formatted_results,
            total_count=total_count,
            search_id=search_id,
            execution_time_ms=execution_time
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/suggestions")
async def get_search_suggestions(pdf_id: str, partial: str):
    """Get search suggestions based on partial query."""
    suggestions = search_store.get_search_suggestions(pdf_id, partial)
    
    return {
        "suggestions": suggestions,
        "partial_query": partial
    }

@router.get("/navigation/{pdf_id}")
async def get_navigation_map(pdf_id: str, page: Optional[int] = None):
    """Get hierarchical navigation map for the PDF."""
    nav_map = search_store.get_navigation_map(pdf_id)
    
    if page is not None:
        nav_map = {str(page): nav_map.get(page, {})}
    
    return {
        "pdf_id": pdf_id,
        "navigation": nav_map,
        "total_pages": len(nav_map)
    }

@router.get("/cache/stats/{pdf_id}")
async def get_cache_statistics(pdf_id: str):
    """Get search cache statistics for monitoring."""
    if pdf_id not in search_store.pdf_caches:
        raise HTTPException(status_code=404, detail="PDF cache not found")
    
    cache = search_store.pdf_caches[pdf_id]
    
    return {
        "pdf_id": pdf_id,
        "last_updated": cache.last_updated.isoformat(),
        "access_count": cache.access_count,
        "total_segments": len(cache.semantic_index.segments),
        "indexed_words": len(cache.semantic_index.inverted_index),
        "indexed_entities": len(cache.semantic_index.entity_index),
        "recent_searches": cache.search_history[-10:],
        "optimization_metrics": cache.optimization_metrics
    }

@router.post("/batch-search")
async def batch_search(pdf_id: str, queries: List[str], search_type: str = "hybrid"):
    """Execute multiple searches in batch for efficiency."""
    results = {}
    
    for query in queries:
        search_results = search_store.search(pdf_id, query, search_type)
        results[query] = [
            {
                "reference": seg.get_reference(),
                "content": seg.content[:100] + "..." if len(seg.content) > 100 else seg.content,
                "page": seg.page
            }
            for seg in search_results[:5]
        ]
    
    return {
        "pdf_id": pdf_id,
        "batch_results": results
    }

def _calculate_highlight_positions(text: str, query: str) -> List[List[int]]:
    """Calculate character positions for highlighting search terms."""
    positions = []
    query_words = query.lower().split()
    text_lower = text.lower()
    
    for word in query_words:
        start = 0
        while True:
            pos = text_lower.find(word, start)
            if pos == -1:
                break
            positions.append([pos, pos + len(word)])
            start = pos + 1
    
    positions.sort(key=lambda x: x[0])
    
    merged = []
    for start, end in positions:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    
    return merged