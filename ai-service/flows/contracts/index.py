"""
Contract Processing Index
Main entry point for all contract-related document processing workflows.
"""

from typing import Dict, Any
from utils.logging import setup_logger

logger = setup_logger(__name__)

class ContractIndex:
    """
    Main index for contract processing workflows.
    Routes contract documents to appropriate processing pipelines.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
        
        # Available contract workflows
        self.available_workflows = {
            "summarize": "Document summarization and strategic briefing",
            # Future workflows can be added here:
            # "analyze": "Contract analysis and risk assessment",
            # "extract": "Data extraction and structured output",
            # "compare": "Contract comparison and gap analysis",
        }
        
        # Initialize workflows
        self.workflows = {}
        self._initialize_workflows()
    
    def _initialize_workflows(self):
        """Initialize available contract workflows."""
        
        # Import summarize workflow
        from flows.contracts.summarize.contract_workflow import ContractWorkflow
        
        self.workflows = {
            "summarize": ContractWorkflow(self.openai_client),
        }
        
        logger.info(f"Initialized {len(self.workflows)} contract workflows")
    
    async def process_contract(self, pdf_data: Dict[str, Any], workflow_type: str = "summarize") -> Dict[str, Any]:
        """
        Process a contract document through the specified workflow.
        
        Args:
            pdf_data: Dictionary containing PDF data from classification
            workflow_type: Type of workflow to use (default: "summarize")
            
        Returns:
            Dictionary with workflow processing results
        """
        pdf_id = pdf_data.get('pdf_id', 'unknown')
        logger.info(f"Processing contract {pdf_id} with {workflow_type} workflow")
        
        # Validate workflow type
        if workflow_type not in self.workflows:
            logger.error(f"Unknown workflow type: {workflow_type}")
            return {
                "response": f"Unknown contract workflow type: {workflow_type}",
                "citations": [],
                "has_citations": False,
                "error": f"Unsupported workflow type: {workflow_type}",
                "pdf_id": pdf_id,
                "available_workflows": list(self.available_workflows.keys())
            }
        
        # Get workflow and execute it
        workflow = self.workflows[workflow_type]
        
        try:
            if workflow_type == "summarize":
                # Execute the workflow directly (workflow manager handles execution)
                result = await workflow.process_contract(pdf_data)
            else:
                # Future workflow types can be added here
                raise ValueError(f"Workflow routing not implemented for: {workflow_type}")
            
            # Add workflow metadata
            result['workflow_type'] = workflow_type
            result['workflow_index'] = 'contracts'
            
            return result
            
        except Exception as e:
            logger.error(f"Contract {workflow_type} workflow failed for {pdf_id}: {str(e)}")
            return {
                "response": f"Contract {workflow_type} workflow failed: {str(e)}",
                "citations": [],
                "has_citations": False,
                "error": str(e),
                "pdf_id": pdf_id,
                "workflow_type": workflow_type,
                "workflow_index": 'contracts'
            }
    
    def get_workflow_instructions(self, workflow_type: str = "summarize") -> Dict[str, Any]:
        """
        Get workflow instructions for the workflow manager.
        Future enhancement: flow indexes can provide detailed step instructions.
        
        Args:
            workflow_type: Type of workflow to get instructions for
            
        Returns:
            Dictionary with workflow instructions for the workflow manager
        """
        if workflow_type == "summarize":
            return {
                "workflow_type": "contract_summarize",
                "description": "4-step contract summarization workflow",
                "steps": [
                    {"name": "analysis", "description": "Deterministic analysis"},
                    {"name": "mapping", "description": "Navigation mapping"},
                    {"name": "interpretation", "description": "Strategic briefing"},
                    {"name": "publishing", "description": "Final formatting"}
                ]
            }
        else:
            return {
                "workflow_type": f"contract_{workflow_type}",
                "description": f"Contract {workflow_type} workflow",
                "steps": []
            }
    
    def get_available_workflows(self) -> Dict[str, str]:
        """Get list of available contract workflows."""
        return self.available_workflows
    
    def get_workflow_info(self, workflow_type: str = None) -> Dict[str, Any]:
        """Get information about contract workflows."""
        
        if workflow_type:
            # Get specific workflow info
            if workflow_type in self.workflows:
                workflow = self.workflows[workflow_type]
                if hasattr(workflow, 'get_workflow_info'):
                    info = workflow.get_workflow_info()
                    info['workflow_index'] = 'contracts'
                    return info
                else:
                    return {
                        "workflow_type": workflow_type,
                        "workflow_index": "contracts",
                        "description": self.available_workflows.get(workflow_type, "No description available")
                    }
            else:
                return {
                    "workflow_type": workflow_type,
                    "workflow_index": "contracts",
                    "available": False,
                    "error": f"Workflow '{workflow_type}' not found"
                }
        else:
            # Get all workflow info
            return {
                "workflow_index": "contracts",
                "available_workflows": self.available_workflows,
                "total_workflows": len(self.workflows),
                "default_workflow": "summarize"
            }
    
    def is_workflow_available(self, workflow_type: str) -> bool:
        """Check if a specific workflow is available."""
        return workflow_type in self.workflows
    
    async def get_workflow_status(self) -> Dict[str, Any]:
        """Get status of all contract workflows."""
        
        status = {
            "workflow_index": "contracts",
            "status": "healthy",
            "workflows": {}
        }
        
        for workflow_type in self.workflows:
            try:
                # Basic health check
                status["workflows"][workflow_type] = {
                    "status": "available",
                    "description": self.available_workflows.get(workflow_type, "No description")
                }
            except Exception as e:
                status["workflows"][workflow_type] = {
                    "status": "error",
                    "error": str(e)
                }
                status["status"] = "degraded"
        
        return status