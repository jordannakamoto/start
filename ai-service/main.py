from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
from core.pdf_service import PDFService
from frontend_api.search_api import router as search_router
from frontend_api.status_publisher import router as status_router
from utils.logging import setup_logger
from openai import AsyncOpenAI
import os
from dotenv import load_dotenv

logger = setup_logger(__name__)

# Request/Response Models
class PDFIngestRequest(BaseModel):
    pages: Dict[str, str]

class AssistantMessageRequest(BaseModel):
    user_id: str
    message: str

class CitationResolveRequest(BaseModel):
    pdf_id: str
    citation: str

# Initialize environment
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY is not set in .env. Using mock responses.")
    openai_client = None
else:
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Initialize PDF service
pdf_service = PDFService(openai_client)

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
app.include_router(status_router)

@app.post("/ingest-pdf")
async def ingest(request: PDFIngestRequest):
    """
    Receives PDF pages payload, processes them through AI pipeline, and returns results.
    """
    try:
        result = await pdf_service.ingest_pdf(request.pages)
        
        # Check if the result indicates an error
        if isinstance(result, dict) and result.get("status") == "failed":
            raise HTTPException(status_code=500, detail=result.get("error", "PDF ingestion failed"))
        
        return result
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"PDF ingestion endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to ingest PDF: {str(e)}")

@app.post("/assistant-message")
async def assistant_message(request: AssistantMessageRequest):
    """
    Receives a chat message for the AI assistant and returns the AI-generated reply with citations.
    """
    try:
        response_data = await pdf_service.process_assistant_message(request.message, request.user_id)
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize-pdf")
async def summarize_pdf(pdf_id: str = Form(...)):
    """
    Summarizes a PDF document that has been previously ingested.
    """
    try:
        result = await pdf_service.process_pdf_summary(pdf_id)
        return result
    except Exception as e:
        logger.error(f"PDF summarization endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error summarizing PDF: {str(e)}")

@app.post("/resolve-citation")
async def resolve_citation_endpoint(
    pdf_id: str = Form(...),
    citation: str = Form(...)
):
    """
    Resolves a citation reference to its location and content in the PDF.
    """
    try:
        # Use citation service directly for now
        from services.citation_service import CitationService
        citation_service = CitationService()
        result = await citation_service.resolve_citation(pdf_id, citation)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))