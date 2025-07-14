import os
import hashlib
import asyncio
from dotenv import load_dotenv
from models import PDFIngestRequest, AssistantMessageRequest
from integrated_pdf_flow import process_pdf_with_search, search_processed_pdf
from search_datastore import SearchDataStore
from search_api import search_store
from openai import AsyncOpenAI
from enhanced_inference import EnhancedInferenceEngine

# Initialize environment
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY is not set in .env. Using mock responses.")
    openai_client = None
    enhanced_engine = None
else:
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    enhanced_engine = EnhancedInferenceEngine(openai_client)

# PocketFlow core classes
from pocketflow import Flow, AsyncFlow, Node, BatchFlow, AsyncNode

async def ingest_pdf(request: PDFIngestRequest) -> dict:
    """
    Receives PDF pages, processes them through the AI pipeline,
    and returns processing results with job ID.
    """
    try:
        # Debug logging
        print(f"🔍 DEBUG: Received {len(request.pages)} pages")
        total_chars = sum(len(content) for content in request.pages.values())
        print(f"🔍 DEBUG: Total characters: {total_chars}")
        for page_num, content in request.pages.items():
            print(f"🔍 DEBUG: Page {page_num}: {len(content)} characters")
            print(f"🔍 DEBUG: Page {page_num} preview: {content[:100]}...")
        
        # Create unique PDF ID
        pages_str = str(sorted(request.pages.items()))
        pdf_content_hash = hashlib.md5(pages_str.encode()).hexdigest()[:16]
        pdf_id = f"pdf_{pdf_content_hash}"
        
        # Process PDF with search indexing
        result = await process_pdf_with_search(request.pages, pdf_id)
        
        return {
            "job_id": pdf_id,
            "status": "completed",
            "processing_result": result,
            "total_pages": len(request.pages),
            "citations_extracted": result.get("total_citations", 0)
        }
        
    except Exception as e:
        error_pages_str = str(sorted(request.pages.items()))
        return {
            "job_id": f"error_{hashlib.md5(error_pages_str.encode()).hexdigest()[:8]}",
            "status": "failed",
            "error": str(e)
        }

async def process_assistant_message(request: AssistantMessageRequest) -> dict:
    """
    Receives a chat message, routes through the AI assistant pipeline,
    and returns the AI-generated response with citations.
    """
    try:
        # Check if this is a PDF summarization request
        if request.message.startswith("summarize_pdf:"):
            pdf_id = request.message.split(":", 1)[1]
            return await summarize_pdf_with_citations(pdf_id)
        
        # Regular AI assistant message
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant. Keep responses concise and informative."},
                    {"role": "user", "content": request.message}
                ],
                max_tokens=500
            )
            
            ai_response = response.choices[0].message.content
        else:
            # Mock response when no API key
            ai_response = f"Mock AI response to: {request.message}"
        
        return {
            "response": ai_response,
            "citations": [],
            "has_citations": False
        }
        
    except Exception as e:
        return {
            "response": f"I apologize, but I encountered an error processing your message: {str(e)}",
            "citations": [],
            "has_citations": False,
            "error": str(e)
        }

async def summarize_pdf_with_citations(pdf_id: str) -> dict:
    """
    Generate AI summary of PDF with citations.
    """
    try:
        # Search for key content in the PDF using the search store directly
        if pdf_id not in search_store.pdf_caches:
            return {
                "response": "PDF not found in search index. Please ensure the PDF has been processed correctly.",
                "citations": [],
                "has_citations": False
            }
        
        # Get segments from across the PDF for comprehensive summarization
        cache = search_store.pdf_caches[pdf_id]
        all_segments = list(cache.semantic_index.segments.values())
        
        # Sort segments by page, paragraph, sentence for proper order
        all_segments.sort(key=lambda s: (s.page, s.paragraph, s.sentence))
        
        # Select segments more intelligently:
        # - Take more segments for longer documents
        # - Distribute across all pages 
        total_segments = len(all_segments)
        max_segments = min(50, max(20, total_segments // 2))  # Between 20-50 segments
        
        # Try to get segments from each page
        segments_by_page = {}
        for segment in all_segments:
            page = segment.page
            if page not in segments_by_page:
                segments_by_page[page] = []
            segments_by_page[page].append(segment)
        
        # Select segments distributed across pages
        selected_segments = []
        segments_per_page = max(1, max_segments // len(segments_by_page))
        
        for page, page_segments in segments_by_page.items():
            # Take up to segments_per_page from each page
            selected_segments.extend(page_segments[:segments_per_page])
        
        # If we still have room, add more segments from the beginning
        if len(selected_segments) < max_segments:
            remaining = max_segments - len(selected_segments)
            for segment in all_segments:
                if segment not in selected_segments:
                    selected_segments.append(segment)
                    remaining -= 1
                    if remaining <= 0:
                        break
        
        # Sort selected segments back to proper order
        selected_segments.sort(key=lambda s: (s.page, s.paragraph, s.sentence))
        
        key_results = []
        for segment in selected_segments:
            key_results.append({
                'segment': {
                    'content': segment.content,
                    'reference': segment.get_reference(),
                    'page': segment.page,
                    'paragraph': segment.paragraph,
                    'sentence': segment.sentence,
                    'char_range': [segment.char_start, segment.char_end]
                }
            })
        
        if not key_results:
            return {
                "response": "I couldn't find sufficient content to summarize this PDF. Please ensure the PDF has been processed correctly.",
                "citations": [],
                "has_citations": False
            }
        
        # Prepare context for AI
        context_segments = []
        citations = []
        
        # Use more segments for better multipage coverage
        max_segments_for_context = min(30, len(key_results))  # Use up to 30 segments
        
        for result in key_results[:max_segments_for_context]:
            segment = result['segment']
            context_segments.append(f"[{segment['reference']}]: {segment['content']}")
            citations.append(segment['reference'])
        
        context_text = "\n".join(context_segments)
        
        if openai_client and enhanced_engine:
            # Use enhanced inference engine for citation-aware analysis
            try:
                analysis_result = await enhanced_engine.analyze_document(key_results)
                
                # Use only the clean user summary (no metadata)
                ai_summary = analysis_result['user_summary']
                
                # Log internal analysis for debugging (not shown to user)
                print(f"🔍 Enhanced Analysis: {analysis_result['citation_count']} citations validated")
                
            except Exception as e:
                print(f"Enhanced analysis failed, falling back to basic summary: {e}")
                # Fallback to basic summarization
                ai_summary = await _generate_basic_summary(context_text, openai_client)
        elif openai_client:
            # Fallback to basic summarization
            ai_summary = await _generate_basic_summary(context_text, openai_client)
        else:
            # Mock summary when no API key
            ai_summary = f"""# PDF Summary

## Key Points

Based on the analysis of this document, here are the main findings:

1. **Primary Topic**: The document discusses important concepts and methodologies {citations[0] if citations else '[p1.para1.s1]'}

2. **Key Insights**: Several significant conclusions were drawn from the analysis {citations[1] if len(citations) > 1 else '[p1.para2.s1]'}

3. **Important Details**: The document provides comprehensive information on the subject matter {citations[2] if len(citations) > 2 else '[p2.para1.s1]'}

## Conclusion

This document presents valuable information that contributes to understanding the topic {citations[-1] if citations else '[p2.para2.s1]'}.

*Note: This is a mock summary. Configure OpenAI API key for real AI-powered summaries.*"""
        
        # Extract citations from the response
        import re
        citation_pattern = r'\[p\d+\.para\d+\.s\d+\]'
        found_citations = re.findall(citation_pattern, ai_summary)
        
        return {
            "response": ai_summary,
            "citations": found_citations,
            "has_citations": len(found_citations) > 0,
            "pdf_id": pdf_id
        }
        
    except Exception as e:
        return {
            "response": f"I apologize, but I encountered an error while summarizing the PDF: {str(e)}",
            "citations": [],
            "has_citations": False,
            "error": str(e)
        }

async def _generate_basic_summary(context_text: str, openai_client) -> str:
    """Fallback basic summarization function"""
    prompt = f"""Please provide a comprehensive summary of this PDF content. Include the citation references in your response using the exact format provided (e.g., [p1.para2.s3]).

Context from PDF:
{context_text}

Instructions:
1. Provide a structured summary with main points
2. Include relevant citations after each point using the exact reference format
3. Focus on the most important information
4. Keep the summary concise but informative
"""
    
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an expert document summarizer. Always include citations in the exact format provided."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=2000,
        temperature=0.3
    )
    
    return response.choices[0].message.content

async def resolve_citation(pdf_id: str, citation: str) -> dict:
    """
    Resolve a citation reference to searchable content and coordinate information.
    """
    try:
        # Clean citation format (remove brackets if present)
        clean_citation = citation.strip('[]')
        
        # Search directly in the search store for the citation reference
        if pdf_id not in search_store.pdf_caches:
            return {
                "citation": citation,
                "found": False,
                "error": "PDF not found in search index"
            }
        
        cache = search_store.pdf_caches[pdf_id]
        
        # Look for segment with matching reference
        for segment in cache.semantic_index.segments.values():
            if segment.get_reference() == clean_citation:
                return {
                    "citation": citation,
                    "found": True,
                    "content": segment.content,
                    "page": segment.page,
                    "paragraph": segment.paragraph,
                    "sentence": segment.sentence,
                    "char_range": [segment.char_start, segment.char_end],
                    "context": {}
                }
        
        return {
            "citation": citation,
            "found": False,
            "error": "Citation reference not found"
        }
        
    except Exception as e:
        return {
            "citation": citation,
            "found": False,
            "error": str(e)
        }