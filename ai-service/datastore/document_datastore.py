"""
Document Datastore
Handles persistence and retrieval of PDF documents and their processing states.
"""

import json
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from utils.logging import setup_logger

logger = setup_logger(__name__)

class DocumentStatus(Enum):
    """Document processing status"""
    INGESTED = "ingested"
    CLASSIFIED = "classified"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class DocumentRecord:
    """Document record structure"""
    pdf_id: str
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime
    pages: Dict[str, str]
    total_pages: int
    document_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    classification_metadata: Optional[Dict[str, Any]] = None
    processing_results: Optional[Dict[str, Any]] = None
    workflow_history: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.workflow_history is None:
            self.workflow_history = []

class DocumentDatastore:
    """
    Document datastore for persisting PDF documents and their processing states.
    Currently uses file-based storage, but can be easily extended to use databases.
    """
    
    def __init__(self, storage_path: str = "datastore/documents"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Index file for quick lookups
        self.index_file = self.storage_path / "document_index.json"
        self.index = self._load_index()
        
        logger.info(f"Document datastore initialized at {self.storage_path}")
    
    def _load_index(self) -> Dict[str, Dict[str, Any]]:
        """Load document index from file"""
        try:
            if self.index_file.exists():
                with open(self.index_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load document index: {e}")
        
        return {}
    
    def _save_index(self):
        """Save document index to file"""
        try:
            with open(self.index_file, 'w') as f:
                json.dump(self.index, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save document index: {e}")
    
    def _get_document_file_path(self, pdf_id: str) -> Path:
        """Get file path for document storage"""
        return self.storage_path / f"{pdf_id}.json"
    
    def store_document(self, pdf_id: str, pages: Dict[str, str], 
                      status: DocumentStatus = DocumentStatus.INGESTED,
                      document_type: Optional[str] = None,
                      classification_confidence: Optional[float] = None,
                      classification_metadata: Optional[Dict[str, Any]] = None,
                      processing_results: Optional[Dict[str, Any]] = None) -> bool:
        """
        Store or update a document in the datastore.
        
        Args:
            pdf_id: Unique document identifier
            pages: Document pages content
            status: Current processing status
            document_type: Classified document type
            classification_confidence: Classification confidence score
            classification_metadata: Additional classification metadata
            processing_results: Final processing results
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            now = datetime.now()
            
            # Check if document already exists
            existing_doc = self.get_document(pdf_id)
            
            if existing_doc:
                # Update existing document
                document = DocumentRecord(
                    pdf_id=pdf_id,
                    status=status,
                    created_at=datetime.fromisoformat(existing_doc['created_at']),
                    updated_at=now,
                    pages=pages,
                    total_pages=len(pages),
                    document_type=document_type or existing_doc.get('document_type'),
                    classification_confidence=classification_confidence or existing_doc.get('classification_confidence'),
                    classification_metadata=classification_metadata or existing_doc.get('classification_metadata'),
                    processing_results=processing_results or existing_doc.get('processing_results'),
                    workflow_history=existing_doc.get('workflow_history', [])
                )
                
                # Add workflow history entry
                document.workflow_history.append({
                    'timestamp': now.isoformat(),
                    'status': status.value,
                    'action': 'updated',
                    'document_type': document_type,
                    'confidence': classification_confidence
                })
                
                logger.info(f"Updated existing document {pdf_id}")
            else:
                # Create new document
                document = DocumentRecord(
                    pdf_id=pdf_id,
                    status=status,
                    created_at=now,
                    updated_at=now,
                    pages=pages,
                    total_pages=len(pages),
                    document_type=document_type,
                    classification_confidence=classification_confidence,
                    classification_metadata=classification_metadata,
                    processing_results=processing_results,
                    workflow_history=[{
                        'timestamp': now.isoformat(),
                        'status': status.value,
                        'action': 'created',
                        'document_type': document_type,
                        'confidence': classification_confidence
                    }]
                )
                
                logger.info(f"Created new document {pdf_id}")
            
            # Save document to file
            document_file = self._get_document_file_path(pdf_id)
            document_dict = asdict(document)
            document_dict['created_at'] = document.created_at.isoformat()
            document_dict['updated_at'] = document.updated_at.isoformat()
            document_dict['status'] = document.status.value
            
            with open(document_file, 'w') as f:
                json.dump(document_dict, f, indent=2, default=str)
            
            # Update index
            self.index[pdf_id] = {
                'pdf_id': pdf_id,
                'status': status.value,
                'document_type': document_type,
                'created_at': document.created_at.isoformat(),
                'updated_at': document.updated_at.isoformat(),
                'total_pages': len(pages),
                'file_path': str(document_file)
            }
            
            self._save_index()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to store document {pdf_id}: {str(e)}")
            return False
    
    def get_document(self, pdf_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a document from the datastore.
        
        Args:
            pdf_id: Document identifier
            
        Returns:
            Document data or None if not found
        """
        try:
            document_file = self._get_document_file_path(pdf_id)
            
            if not document_file.exists():
                return None
            
            with open(document_file, 'r') as f:
                document_data = json.load(f)
            
            return document_data
            
        except Exception as e:
            logger.error(f"Failed to retrieve document {pdf_id}: {str(e)}")
            return None
    
    def get_document_pages(self, pdf_id: str) -> Optional[Dict[str, str]]:
        """Get just the pages content for a document"""
        document = self.get_document(pdf_id)
        if document:
            return document.get('pages', {})
        return None
    
    def get_document_status(self, pdf_id: str) -> Optional[DocumentStatus]:
        """Get the current status of a document"""
        document = self.get_document(pdf_id)
        if document:
            return DocumentStatus(document['status'])
        return None
    
    def update_document_status(self, pdf_id: str, status: DocumentStatus, 
                             processing_results: Optional[Dict[str, Any]] = None) -> bool:
        """
        Update the status of a document.
        
        Args:
            pdf_id: Document identifier
            status: New status
            processing_results: Optional final processing results
            
        Returns:
            bool: True if successful, False otherwise
        """
        document = self.get_document(pdf_id)
        if not document:
            logger.warning(f"Document {pdf_id} not found for status update")
            return False
        
        # Update the document with new status
        return self.store_document(
            pdf_id=pdf_id,
            pages=document['pages'],
            status=status,
            document_type=document.get('document_type'),
            classification_confidence=document.get('classification_confidence'),
            classification_metadata=document.get('classification_metadata'),
            processing_results=processing_results or document.get('processing_results')
        )
    
    def list_documents(self, status: Optional[DocumentStatus] = None, 
                      document_type: Optional[str] = None,
                      limit: int = 100) -> List[Dict[str, Any]]:
        """
        List documents with optional filtering.
        
        Args:
            status: Filter by status
            document_type: Filter by document type
            limit: Maximum number of results
            
        Returns:
            List of document summaries
        """
        results = []
        
        for pdf_id, doc_info in self.index.items():
            # Apply filters
            if status and doc_info['status'] != status.value:
                continue
            
            if document_type and doc_info.get('document_type') != document_type:
                continue
            
            results.append(doc_info)
            
            if len(results) >= limit:
                break
        
        # Sort by updated_at descending
        results.sort(key=lambda x: x['updated_at'], reverse=True)
        
        return results
    
    def delete_document(self, pdf_id: str) -> bool:
        """
        Delete a document from the datastore.
        
        Args:
            pdf_id: Document identifier
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            document_file = self._get_document_file_path(pdf_id)
            
            if document_file.exists():
                document_file.unlink()
            
            # Remove from index
            if pdf_id in self.index:
                del self.index[pdf_id]
                self._save_index()
            
            logger.info(f"Deleted document {pdf_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete document {pdf_id}: {str(e)}")
            return False
    
    def cleanup_old_documents(self, max_age_days: int = 30) -> int:
        """
        Clean up old documents from the datastore.
        
        Args:
            max_age_days: Maximum age in days
            
        Returns:
            Number of documents cleaned up
        """
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        cleaned_count = 0
        
        documents_to_delete = []
        
        for pdf_id, doc_info in self.index.items():
            try:
                updated_at = datetime.fromisoformat(doc_info['updated_at'])
                if updated_at < cutoff_date:
                    documents_to_delete.append(pdf_id)
            except Exception as e:
                logger.warning(f"Failed to parse date for document {pdf_id}: {e}")
        
        for pdf_id in documents_to_delete:
            if self.delete_document(pdf_id):
                cleaned_count += 1
        
        logger.info(f"Cleaned up {cleaned_count} old documents")
        return cleaned_count
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get datastore statistics"""
        total_documents = len(self.index)
        status_counts = {}
        type_counts = {}
        
        for doc_info in self.index.values():
            status = doc_info['status']
            doc_type = doc_info.get('document_type', 'unknown')
            
            status_counts[status] = status_counts.get(status, 0) + 1
            type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
        
        return {
            'total_documents': total_documents,
            'status_counts': status_counts,
            'type_counts': type_counts,
            'storage_path': str(self.storage_path)
        }

# Global document datastore instance
document_datastore = DocumentDatastore()