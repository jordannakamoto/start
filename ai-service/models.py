from pydantic import BaseModel
from typing import Dict, Any

class PDFIngestRequest(BaseModel):
    pages: Dict[int, str]

class AssistantMessageRequest(BaseModel):
    user_id: str
    message: str

class CitationResolveRequest(BaseModel):
    pdf_id: str
    citation: str