"""
Workflow Manager - Simple executor that runs workflow instructions from flow indexes
"""

from typing import Dict, Any
from utils.logging import setup_logger
from frontend_api.status_publisher import status_publisher, WorkflowStatus

logger = setup_logger(__name__)

class WorkflowManager:
    """
    Simple workflow executor that runs instructions provided by flow indexes.
    Does not make routing decisions - just executes the workflow steps as directed.
    """
    
    def __init__(self, openai_client=None):
        self.openai_client = openai_client
    
    async def execute_workflow(self, workflow_instructions: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a workflow based on instructions from a flow index.
        
        Args:
            workflow_instructions: Dictionary containing:
                - workflow_type: Type of workflow (e.g., "contract_summarize")
                - steps: List of step instructions
                - data: Input data for the workflow
                
        Returns:
            Dictionary with workflow execution results
        """
        workflow_type = workflow_instructions.get('workflow_type', 'unknown')
        steps = workflow_instructions.get('steps', [])
        data = workflow_instructions.get('data', {})
        
        logger.info(f"Executing workflow: {workflow_type} with {len(steps)} steps")
        
        try:
            # Execute each step in sequence
            current_data = data
            step_results = []
            
            for i, step_instruction in enumerate(steps):
                step_name = step_instruction.get('name', f'step_{i+1}')
                step_processor = step_instruction.get('processor')
                step_params = step_instruction.get('params', {})
                
                logger.info(f"Executing step {i+1}: {step_name}")
                
                # Execute the step
                if step_processor:
                    step_result = await step_processor.process(current_data, **step_params)
                    step_results.append({
                        'step_name': step_name,
                        'result': step_result,
                        'status': 'completed'
                    })
                    
                    # Update current data for next step
                    current_data = step_result
                else:
                    logger.error(f"No processor found for step: {step_name}")
                    step_results.append({
                        'step_name': step_name,
                        'result': None,
                        'status': 'failed',
                        'error': 'No processor defined'
                    })
                    break
            
            # Return final result
            return {
                'workflow_type': workflow_type,
                'status': 'completed',
                'final_result': current_data,
                'step_results': step_results,
                'total_steps': len(steps)
            }
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}")
            return {
                'workflow_type': workflow_type,
                'status': 'failed',
                'error': str(e),
                'step_results': step_results,
                'total_steps': len(steps)
            }
    
    async def execute_simple_workflow(self, workflow_callable, data: Dict[str, Any], workflow_id: str = None) -> Dict[str, Any]:
        """
        Execute a simple workflow that provides its own execution logic.
        
        Args:
            workflow_callable: Async function that executes the workflow
            data: Input data for the workflow
            workflow_id: Optional workflow ID for status tracking
            
        Returns:
            Dictionary with workflow execution results
        """
        try:
            logger.info("Executing simple workflow")
            
            # Publish start status if workflow_id provided
            if workflow_id:
                await status_publisher.start_workflow(workflow_id, "simple_workflow")
            
            result = await workflow_callable(data)
            
            # Publish completion status
            if workflow_id:
                await status_publisher.complete_workflow(workflow_id, result)
            
            return {
                'status': 'completed',
                'result': result
            }
            
        except Exception as e:
            logger.error(f"Simple workflow execution failed: {str(e)}")
            
            # Publish failure status
            if workflow_id:
                await status_publisher.fail_workflow(workflow_id, str(e), "simple_workflow")
            
            return {
                'status': 'failed',
                'error': str(e)
            }
    
    def get_execution_info(self) -> Dict[str, Any]:
        """Get information about the workflow manager."""
        return {
            'component': 'WorkflowManager',
            'purpose': 'Executes workflow instructions from flow indexes',
            'capabilities': [
                'Sequential step execution',
                'Error handling and recovery',
                'Step result tracking',
                'Simple workflow support'
            ]
        }