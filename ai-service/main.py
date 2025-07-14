from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import PDFIngestRequest, AssistantMessageRequest, CitationResolveRequest
from services import ingest_pdf, process_assistant_message, resolve_citation
from search_api import router as search_router

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)

@app.post("/ingest-pdf")
async def ingest(request: PDFIngestRequest):
    """
    Receives PDF pages payload, processes them through AI pipeline, and returns results.
    """
    try:
        result = await ingest_pdf(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/assistant-message")
async def assistant_message(request: AssistantMessageRequest):
    """
    Receives a chat message for the AI assistant and returns the AI-generated reply with citations.
    """
    try:
        response_data = await process_assistant_message(request)
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resolve-citation")
async def resolve_citation_endpoint(request: CitationResolveRequest):
    """
    Resolves a citation reference to its location and content in the PDF.
    """
    try:
        result = await resolve_citation(request.pdf_id, request.citation)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))