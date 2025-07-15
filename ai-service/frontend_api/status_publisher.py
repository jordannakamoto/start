"""
Status Publisher for Workflow Progress
Publishes workflow status updates for frontend consumption
"""

import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from fastapi import APIRouter
from utils.logging import setup_logger

logger = setup_logger(__name__)

class WorkflowStatus(Enum):
    """Workflow status states"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"

@dataclass
class StatusUpdate:
    """Status update data structure"""
    workflow_id: str
    step_name: str
    status: WorkflowStatus
    message: str
    timestamp: datetime = field(default_factory=datetime.now)
    progress_percent: Optional[int] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class StatusPublisher:
    """
    Publishes workflow status updates for frontend consumption.
    Maintains status history and provides real-time updates.
    """
    
    def __init__(self):
        self.status_store: Dict[str, Dict[str, Any]] = {}
        self.status_history: Dict[str, list] = {}
        self.step_definitions = {
            "pdf_ingestion": {"order": 1, "name": "PDF Ingestion", "description": "Processing PDF content"},
            "document_classification": {"order": 2, "name": "Document Classification", "description": "Determining document type"},
            "contract_analysis": {"order": 3, "name": "Contract Analysis", "description": "Extracting structured claims"},
            "contract_mapping": {"order": 4, "name": "Contract Mapping", "description": "Creating navigation structure"},
            "contract_interpretation": {"order": 5, "name": "Contract Interpretation", "description": "Strategic briefing conversion"},
            "contract_publishing": {"order": 6, "name": "Contract Publishing", "description": "Final formatting and citation linking"},
        }
    
    async def publish_status(self, workflow_id: str, step_name: str, status: WorkflowStatus, 
                           message: str, progress_percent: Optional[int] = None, 
                           error: Optional[str] = None, metadata: Dict[str, Any] = None):
        """
        Publish a status update for a workflow step.
        
        Args:
            workflow_id: Unique identifier for the workflow
            step_name: Name of the current step
            status: Current status of the step
            message: Human-readable status message
            progress_percent: Optional progress percentage (0-100)
            error: Optional error message if status is FAILED
            metadata: Optional additional metadata
        """
        update = StatusUpdate(
            workflow_id=workflow_id,
            step_name=step_name,
            status=status,
            message=message,
            progress_percent=progress_percent,
            error=error,
            metadata=metadata or {}
        )
        
        # Store current status
        if workflow_id not in self.status_store:
            self.status_store[workflow_id] = {
                "workflow_id": workflow_id,
                "current_step": step_name,
                "overall_status": status.value,
                "started_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "steps": {},
                "progress_percent": 0,
                "error": None
            }
        
        # Update current status
        workflow_status = self.status_store[workflow_id]
        workflow_status["current_step"] = step_name
        workflow_status["overall_status"] = status.value
        workflow_status["last_updated"] = datetime.now().isoformat()
        workflow_status["steps"][step_name] = {
            "status": status.value,
            "message": message,
            "timestamp": update.timestamp.isoformat(),
            "progress_percent": progress_percent,
            "error": error,
            "metadata": metadata or {}
        }
        
        # Calculate overall progress
        workflow_status["progress_percent"] = self._calculate_overall_progress(workflow_id)
        
        # Set error if failed
        if status == WorkflowStatus.FAILED:
            workflow_status["error"] = error
        
        # Add to history
        if workflow_id not in self.status_history:
            self.status_history[workflow_id] = []
        
        self.status_history[workflow_id].append({
            "step_name": step_name,
            "status": status.value,
            "message": message,
            "timestamp": update.timestamp.isoformat(),
            "progress_percent": progress_percent,
            "error": error,
            "metadata": metadata or {}
        })
        
        # Log status update
        logger.info(f"Status update for {workflow_id}: {step_name} -> {status.value} - {message}")
        
        # Keep only last 1000 history items per workflow
        if len(self.status_history[workflow_id]) > 1000:
            self.status_history[workflow_id] = self.status_history[workflow_id][-1000:]
    
    def _calculate_overall_progress(self, workflow_id: str) -> int:
        """Calculate overall progress percentage based on completed steps."""
        if workflow_id not in self.status_store:
            return 0
        
        workflow_status = self.status_store[workflow_id]
        steps = workflow_status["steps"]
        
        if not steps:
            return 0
        
        # Count completed steps
        completed_steps = sum(1 for step_data in steps.values() 
                            if step_data["status"] == WorkflowStatus.COMPLETED.value)
        
        # Calculate progress based on step completion
        total_expected_steps = len(self.step_definitions)
        progress = (completed_steps / total_expected_steps) * 100
        
        return min(100, max(0, int(progress)))
    
    async def start_workflow(self, workflow_id: str, workflow_type: str = "pdf_processing"):
        """Mark the start of a workflow."""
        await self.publish_status(
            workflow_id=workflow_id,
            step_name="workflow_start",
            status=WorkflowStatus.IN_PROGRESS,
            message=f"Starting {workflow_type} workflow",
            progress_percent=0,
            metadata={"workflow_type": workflow_type}
        )
    
    async def complete_workflow(self, workflow_id: str, final_result: Dict[str, Any] = None):
        """Mark the completion of a workflow."""
        await self.publish_status(
            workflow_id=workflow_id,
            step_name="workflow_complete",
            status=WorkflowStatus.COMPLETED,
            message="Workflow completed successfully",
            progress_percent=100,
            metadata={"final_result": final_result or {}}
        )
    
    async def fail_workflow(self, workflow_id: str, error: str, step_name: str = "unknown"):
        """Mark the failure of a workflow."""
        await self.publish_status(
            workflow_id=workflow_id,
            step_name=step_name,
            status=WorkflowStatus.FAILED,
            message=f"Workflow failed: {error}",
            error=error,
            progress_percent=None
        )
    
    def get_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a workflow."""
        return self.status_store.get(workflow_id)
    
    def get_history(self, workflow_id: str) -> list:
        """Get status history for a workflow."""
        return self.status_history.get(workflow_id, [])
    
    def get_all_active_workflows(self) -> Dict[str, Dict[str, Any]]:
        """Get all currently active workflows."""
        return {
            workflow_id: status 
            for workflow_id, status in self.status_store.items()
            if status["overall_status"] in [WorkflowStatus.PENDING.value, WorkflowStatus.IN_PROGRESS.value]
        }
    
    def cleanup_old_workflows(self, max_age_hours: int = 24):
        """Clean up old workflow status data."""
        cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
        
        workflows_to_remove = []
        for workflow_id, status in self.status_store.items():
            last_updated = datetime.fromisoformat(status["last_updated"]).timestamp()
            if last_updated < cutoff_time:
                workflows_to_remove.append(workflow_id)
        
        for workflow_id in workflows_to_remove:
            del self.status_store[workflow_id]
            if workflow_id in self.status_history:
                del self.status_history[workflow_id]
            logger.info(f"Cleaned up old workflow: {workflow_id}")

# Global status publisher instance
status_publisher = StatusPublisher()

# FastAPI router for status endpoints
router = APIRouter(prefix="/api/status", tags=["status"])

@router.get("/workflow/{workflow_id}")
async def get_workflow_status(workflow_id: str):
    """Get current status of a workflow."""
    status = status_publisher.get_status(workflow_id)
    if not status:
        return {"error": "Workflow not found", "workflow_id": workflow_id}
    return status

@router.get("/workflow/{workflow_id}/history")
async def get_workflow_history(workflow_id: str):
    """Get status history for a workflow."""
    history = status_publisher.get_history(workflow_id)
    return {"workflow_id": workflow_id, "history": history}

@router.get("/active")
async def get_active_workflows():
    """Get all currently active workflows."""
    return {"active_workflows": status_publisher.get_all_active_workflows()}

@router.post("/cleanup")
async def cleanup_old_workflows(max_age_hours: int = 24):
    """Clean up old workflow status data."""
    status_publisher.cleanup_old_workflows(max_age_hours)
    return {"message": f"Cleaned up workflows older than {max_age_hours} hours"}

@router.get("/datastore/stats")
async def get_datastore_stats():
    """Get document datastore statistics."""
    from datastore.document_datastore import document_datastore
    return document_datastore.get_storage_stats()

@router.get("/datastore/documents")
async def list_documents(status: str = None, document_type: str = None, limit: int = 100):
    """List documents in datastore."""
    from datastore.document_datastore import document_datastore, DocumentStatus
    
    status_filter = None
    if status:
        try:
            status_filter = DocumentStatus(status)
        except ValueError:
            return {"error": f"Invalid status: {status}"}
    
    documents = document_datastore.list_documents(
        status=status_filter,
        document_type=document_type,
        limit=limit
    )
    
    return {"documents": documents, "total": len(documents)}

@router.post("/datastore/cleanup")
async def cleanup_old_documents(max_age_days: int = 30):
    """Clean up old documents from datastore."""
    from datastore.document_datastore import document_datastore
    
    cleaned_count = document_datastore.cleanup_old_documents(max_age_days)
    return {"message": f"Cleaned up {cleaned_count} documents older than {max_age_days} days"}