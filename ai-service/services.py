import os
import hashlib
import asyncio
from dotenv import load_dotenv
from models import PDFIngestRequest, AssistantMessageRequest
from integrated_pdf_flow import process_pdf_with_search, search_processed_pdf
from search_datastore import SearchDataStore
from search_api import search_store
from openai import AsyncOpenAI

# Initialize environment
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY is not set in .env. Using mock responses.")
    openai_client = None
else:
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# PocketFlow core classes
from pocketflow import Flow, AsyncFlow, Node, BatchFlow, AsyncNode

async def ingest_pdf(request: PDFIngestRequest) -> dict:
    """
    Receives PDF pages, processes them through the AI pipeline,
    and returns processing results with job ID.
    """
    try:
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
        
        # Get all segments from the PDF for summarization
        cache = search_store.pdf_caches[pdf_id]
        key_results = []
        for segment in list(cache.semantic_index.segments.values())[:10]:  # Get first 10 segments
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
        
        for result in key_results[:10]:  # Limit to top 10 results
            segment = result['segment']
            context_segments.append(f"[{segment['reference']}]: {segment['content']}")
            citations.append(segment['reference'])
        
        context_text = "\n".join(context_segments)
        
        if openai_client:
            # Generate AI summary with citations
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
                max_tokens=1000,
                temperature=0.3
            )
            
            ai_summary = response.choices[0].message.content
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