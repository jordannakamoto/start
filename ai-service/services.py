import os
import hashlib
import re
import asyncio
from dotenv import load_dotenv
from models import PDFIngestRequest, AssistantMessageRequest
from integrated_pdf_flow import process_pdf_with_search, search_processed_pdf
from search_datastore import SearchDataStore
from search_api import search_store
from openai import AsyncOpenAI
from enhanced_inference import EnhancedInferenceEngine
from deterministic_analysis import DeterministicAnalysisEngine

# Initialize environment
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY is not set in .env. Using mock responses.")
    openai_client = None

openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
deterministic_engine = DeterministicAnalysisEngine()
enhanced_inference_engine = EnhancedInferenceEngine(openai_client) if openai_client else None

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
        
        # Two-stage analysis: Deterministic foundation + LLM navigation summary
        try:
            # Stage 1: Deterministic analysis for structured foundation
            deterministic_result = deterministic_engine.analyze_document(key_results)
            
            # Log deterministic analysis metadata
            metadata = deterministic_result['analysis_metadata']
            print(f"🔍 Deterministic Analysis: {metadata['total_claims']} claims, {metadata['entities_found']} entities")
            print(f"🔍 Claim types: {', '.join(metadata['claim_types'])}")
            
            # Stage 2: LLM creates navigation summary using deterministic data
            if openai_client:
                ai_summary = await _generate_navigation_summary_from_structured_data(
                    deterministic_result, context_text, openai_client
                )
                # Stage 3: Apply strategic briefing tone
                ai_summary = await rewrite_summary_to_strategic_briefing(ai_summary, openai_client)
            else:
                # Fallback to deterministic summary when no OpenAI client
                ai_summary = deterministic_result['structured_summary']
                
        except Exception as e:
            print(f"Analysis failed, falling back to basic summary: {e}")
            if openai_client:
                ai_summary = await _generate_basic_summary(context_text, openai_client)
            else:
                ai_summary = f"""# PDF Summary

## Analysis Error
An error occurred during document analysis: {str(e)}

## Available Data
- Total segments processed: {len(key_results)}
- Citations available: {len(citations)}

*The document has been processed and indexed for search capabilities.*"""
        
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

async def _generate_navigation_summary_from_structured_data(deterministic_result: dict, context_text: str, openai_client) -> str:
    """Generate user-friendly navigation summary using deterministic analysis as foundation"""
    
    # Extract structured data
    knowledge_graph = deterministic_result['knowledge_graph']
    validated_claims = deterministic_result['validated_claims']
    metadata = deterministic_result['analysis_metadata']
    
    # Build prompt with structured foundation
    structured_data_prompt = _build_structured_data_prompt(validated_claims, knowledge_graph, metadata)
    
    prompt = f"""You are creating a user-friendly navigation summary based on rigorous deterministic analysis.

STRUCTURED FOUNDATION (from deterministic analysis):
{structured_data_prompt}

ORIGINAL CONTEXT:
{context_text[:1500]}...

TASK: Create a clean, user-friendly summary that serves as a navigation/mapping assistant. Your summary should:

1. Use the deterministic analysis as the authoritative foundation
2. Organize information for easy navigation and understanding  
3. Maintain all citation references in exact format [pX.paraY.sZ]
4. Present structured claims in a readable, organized way
5. Focus on being a helpful navigation tool, not raw analysis data

CRITICAL: Every claim in your summary MUST be backed by citations from the deterministic analysis. Do not invent claims.

Create a structured summary that helps users navigate and understand this document:"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert document navigator. Create user-friendly summaries that preserve structured analysis while being readable and helpful for navigation."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.2
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"Navigation summary generation failed: {e}")
        # Fallback to deterministic summary
        return deterministic_result['structured_summary']

def _build_structured_data_prompt(claims: list, knowledge_graph, metadata: dict) -> str:
    """Build prompt section with structured deterministic data"""
    
    prompt_parts = [
        f"ANALYSIS METADATA:",
        f"- Total validated claims: {metadata['total_claims']}",
        f"- Claim types found: {', '.join(metadata['claim_types'])}",
        f"- Entities identified: {metadata['entities_found']}",
        f"- Relationships mapped: {metadata['relationships_found']}",
        "",
        "VALIDATED CLAIMS (with citations):"
    ]
    
    # Group claims by type for better organization
    claims_by_type = {}
    for claim in claims:
        claim_type = claim.claim_type
        if claim_type not in claims_by_type:
            claims_by_type[claim_type] = []
        claims_by_type[claim_type].append(claim)
    
    for claim_type, type_claims in claims_by_type.items():
        prompt_parts.append(f"\n{claim_type.upper()} CLAIMS:")
        for claim in type_claims:
            citations_str = ", ".join(f"[{cit}]" for cit in claim.citations)
            prompt_parts.append(f"  - {claim.subject} {claim.predicate} {claim.object or ''} {citations_str}")
            if claim.conditions:
                prompt_parts.append(f"    Conditions: {'; '.join(claim.conditions)}")
            if claim.temporal_scope:
                prompt_parts.append(f"    Timeline: {claim.temporal_scope}")
    
    # Add key entities
    if knowledge_graph.entities:
        prompt_parts.append("\nKEY ENTITIES:")
        for entity_id, entity_data in list(knowledge_graph.entities.items())[:10]:
            citation = entity_data.get('citation', 'unknown')
            prompt_parts.append(f"  - {entity_data['text']} ({entity_data.get('label', 'ENTITY')}) [{citation}]")
    
    return "\n".join(prompt_parts)

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

async def rewrite_summary_to_strategic_briefing(original_summary_text: str, openai_client) -> str:
    """
    Takes a structured summary and rewrites it section by section into a cohesive strategic briefing.

    Args:
        original_summary_text: The full text of the original, structured summary.
        openai_client: An initialized async OpenAI client.

    Returns:
        A single string containing the rewritten, cohesive strategic briefing.
    """

    # --- Step 1: Divide the document into sections ---
    # We use regex to split the text at each numbered heading (e.g., "1. ", "2. ").
    # The (?=...) is a positive lookahead to keep the delimiter in the split parts.
    sections = re.split(r'\n(?=\d+\.\s)', original_summary_text)

    # The first part is the intro, which we'll discard and replace. The rest are the sections to rewrite.
    # We filter out any empty strings that might result from the split.
    sections_to_rewrite = [s.strip() for s in sections[1:] if s.strip()]

    # --- Step 2: Create a rewrite task for each section ---
    tasks = []
    for section_text in sections_to_rewrite:
        tasks.append(_rewrite_section_strategically(section_text, openai_client))

    # --- Step 3: Execute all rewrite tasks in parallel ---
    rewritten_sections = await asyncio.gather(*tasks)

    # --- Step 4: Assemble the final strategic briefing ---
    # Frame the rewritten content with a new, authoritative introduction.
    strategic_introduction = "This briefing outlines the strategic framework of the agreement, focusing on key areas of performance, risk, and operational control."
    
    # Join the high-quality rewritten sections together.
    final_body = "\n\n".join(rewritten_sections)

    return f"{strategic_introduction}\n\n{final_body}"


async def _rewrite_section_strategically(section_text: str, openai_client) -> str:
    """
    Worker function to rewrite a single section of text into a strategic tone.
    """
    prompt = f"""You are rewriting a single section of a legal summary for an executive briefing. 
Your task is to transform the following section into a concise, strategic paragraph.

**Original Section to Rewrite:**
---
{section_text}
---

**Your Instructions:**
1.  **Synthesize, Don't List:** Transform the list of claims into a flowing paragraph or a very tight, strategic bulleted list.
2.  **Focus on Business Implications:** Reframe the points to highlight their purpose (e.g., "To ensure performance," "To maintain financial control," "To define clear terms").
3.  **Discard the Old Header:** Do not include the original numbered header (e.g., "1. Obligation Claims"). The new text must stand on its own.
4.  **Maintain All Citations:** Preserve every citation (e.g., [p1.para2.s3]) exactly as it appears, attached to its corresponding point.
5.  **Use an Authoritative Tone:** The language should be confident, clear, and professional.

Rewrite the section now.
"""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a top-tier strategy consultant who excels at turning dense information into clear, actionable executive insights. Your tone is authoritative and precise."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=500,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Failed to rewrite section: {e}")
        return f"[Rewrite failed for section: {section_text[:50]}...]"

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