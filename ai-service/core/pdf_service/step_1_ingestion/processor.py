"""
Step 1: PDF Ingestion 
Simple PDF ingestion that stores content for later processing.
"""

import hashlib
from typing import Dict, Any
from utils.logging import setup_logger
from datastore.document_datastore import document_datastore, DocumentStatus

logger = setup_logger(__name__)

class PDFIngestionStep:
    """
    Simple PDF ingestion step that stores PDF content.
    """
    
    def __init__(self):
        pass
    
    async def process(self, pages: Dict[str, str]) -> Dict[str, Any]:
        """
        Process PDF pages for ingestion and persist to datastore.
        
        Args:
            pages: Dictionary mapping page numbers to content
            
        Returns:
            Dictionary with ingestion results
        """
        logger.info(f"Starting PDF ingestion with {len(pages)} pages")
        try:
            # Generate PDF ID
            pages_str = str(sorted(pages.items()))
            pdf_content_hash = hashlib.md5(pages_str.encode()).hexdigest()[:16]
            pdf_id = f"pdf_{pdf_content_hash}"
            
            logger.info(f"Processing PDF ingestion for {pdf_id} with {len(pages)} pages")
            
            # Convert page keys to strings for consistency
            normalized_pages = {str(k): v for k, v in pages.items()}
            
            # Store PDF data in datastore
            success = document_datastore.store_document(
                pdf_id=pdf_id,
                pages=normalized_pages,
                status=DocumentStatus.INGESTED
            )
            
            if not success:
                raise Exception("Failed to store document in datastore")
            
            logger.info(f"Successfully stored PDF {pdf_id} in datastore")
            
            return {
                "pdf_id": pdf_id,
                "pages": normalized_pages,
                "total_pages": len(normalized_pages),
                "status": "ingested",
                "stored_in_datastore": True
            }
            
        except Exception as e:
            logger.error(f"PDF ingestion failed: {str(e)}")
            return {
                "pdf_id": "error",
                "error": str(e),
                "status": "failed",
                "stored_in_datastore": False
            }