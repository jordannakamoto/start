"""
Contract Processing Workflow
Handles the complete contract processing pipeline: Analysis -> Mapping -> Interpretation -> Publishing
"""

from typing import Dict, Any
from utils.logging import setup_logger
from frontend_api.status_publisher import status_publisher, WorkflowStatus

logger = setup_logger(__name__)

class ContractWorkflow:
    """
    Contract-specific processing workflow.
    Manages the 4-step contract processing pipeline.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
        
        # Initialize contract-specific steps
        from flows.contracts.summarize.analysis.processor import AnalysisStep
        from flows.contracts.summarize.mapping.processor import MapStep
        from flows.contracts.summarize.interpretation.processor import InterpretStep
        from flows.contracts.summarize.publishing.processor import PublishStep
        
        self.analysis_step = AnalysisStep()
        self.mapping_step = MapStep(openai_client)
        self.interpretation_step = InterpretStep(openai_client)
        self.publishing_step = PublishStep(openai_client)
    
    async def process_contract(self, pdf_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a classified contract through the complete contract workflow.
        
        Args:
            pdf_data: Dictionary containing PDF data from classification
            
        Returns:
            Dictionary with final contract processing results
        """
        pdf_id = pdf_data['pdf_id']
        logger.info(f"Starting contract workflow for PDF {pdf_id}")
        
        try:
            # Step 1: Contract Analysis
            logger.info("Contract Step 1: Starting deterministic analysis")
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_analysis",
                status=WorkflowStatus.IN_PROGRESS,
                message="Analyzing contract structure and extracting claims",
                progress_percent=20
            )
            
            analysis_result = await self.analysis_step.process(pdf_data)
            
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_analysis",
                status=WorkflowStatus.COMPLETED,
                message="Contract analysis completed",
                progress_percent=25
            )
            
            # Step 2: Contract Mapping
            logger.info("Contract Step 2: Creating navigation mapping")
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_mapping",
                status=WorkflowStatus.IN_PROGRESS,
                message="Creating navigation structure",
                progress_percent=40
            )
            
            mapping_result = await self.mapping_step.process(analysis_result)
            
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_mapping",
                status=WorkflowStatus.COMPLETED,
                message="Navigation mapping completed",
                progress_percent=50
            )
            
            # Step 3: Contract Interpretation
            logger.info("Contract Step 3: Strategic interpretation")
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_interpretation",
                status=WorkflowStatus.IN_PROGRESS,
                message="Converting to strategic briefing format",
                progress_percent=65
            )
            
            interpretation_result = await self.interpretation_step.process(mapping_result)
            
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_interpretation",
                status=WorkflowStatus.COMPLETED,
                message="Strategic interpretation completed",
                progress_percent=80
            )
            
            # Step 4: Contract Publishing
            logger.info("Contract Step 4: Final publishing")
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_publishing",
                status=WorkflowStatus.IN_PROGRESS,
                message="Formatting final output with citations",
                progress_percent=90
            )
            
            publishing_result = await self.publishing_step.process(interpretation_result)
            
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_publishing",
                status=WorkflowStatus.COMPLETED,
                message="Contract publishing completed",
                progress_percent=100
            )
            
            logger.info(f"Contract workflow completed for PDF {pdf_id}")
            
            return publishing_result
            
        except Exception as e:
            logger.error(f"Contract workflow failed for PDF {pdf_id}: {str(e)}")
            
            # Publish failure status
            await status_publisher.publish_status(
                workflow_id=pdf_id,
                step_name="contract_workflow",
                status=WorkflowStatus.FAILED,
                message=f"Contract processing failed: {str(e)}",
                error=str(e)
            )
            
            return {
                "response": f"Contract processing failed: {str(e)}",
                "citations": [],
                "has_citations": False,
                "error": str(e),
                "pdf_id": pdf_id
            }
    
    def get_workflow_info(self) -> Dict[str, Any]:
        """Get information about the contract workflow."""
        return {
            "workflow_type": "contract",
            "steps": [
                {
                    "name": "analysis",
                    "description": "Deterministic analysis of contract structure and claims"
                },
                {
                    "name": "mapping",
                    "description": "Navigation mapping for contract navigation"
                },
                {
                    "name": "interpretation",
                    "description": "Strategic interpretation for executive briefing"
                },
                {
                    "name": "publishing",
                    "description": "Final validation and structured publishing"
                }
            ],
            "focus_areas": [
                "obligations",
                "terms",
                "parties",
                "financial_arrangements",
                "compliance",
                "performance_standards"
            ]
        }