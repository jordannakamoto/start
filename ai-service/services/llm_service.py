"""
LLM Service
Handles all OpenAI API interactions and model management.
"""

from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI
from utils.logging import setup_logger

logger = setup_logger(__name__)

class LLMService:
    """
    Service for managing OpenAI API interactions and model operations.
    """
    
    def __init__(self, openai_client: Optional[AsyncOpenAI] = None):
        self.openai_client = openai_client
        self.default_model = "gpt-4o-mini"
        self.default_temperature = 0.2
        self.default_max_tokens = 2000
    
    async def generate_completion(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        model: str = None,
        temperature: float = None,
        max_tokens: int = None
    ) -> str:
        """
        Generate a completion using OpenAI API.
        
        Args:
            system_prompt: System prompt for the model
            user_prompt: User prompt for the model
            model: Model to use (defaults to gpt-4o-mini)
            temperature: Temperature for generation (defaults to 0.2)
            max_tokens: Maximum tokens (defaults to 2000)
            
        Returns:
            Generated completion text
        """
        if not self.openai_client:
            logger.warning("No OpenAI client available")
            return f"Mock response to: {user_prompt[:50]}..."
        
        model = model or self.default_model
        temperature = temperature if temperature is not None else self.default_temperature
        max_tokens = max_tokens or self.default_max_tokens
        
        logger.info(f"Generating completion with model {model}")
        
        try:
            response = await self.openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"OpenAI completion failed: {str(e)}")
            raise e
    
    async def generate_assistant_response(self, message: str) -> str:
        """
        Generate a basic assistant response.
        
        Args:
            message: User message
            
        Returns:
            Assistant response
        """
        system_prompt = "You are a helpful AI assistant. Keep responses concise and informative."
        
        return await self.generate_completion(
            system_prompt=system_prompt,
            user_prompt=message,
            max_tokens=500
        )
    
    async def generate_batch_completions(
        self, 
        system_prompt: str, 
        user_prompts: List[str],
        model: str = None,
        temperature: float = None,
        max_tokens: int = None
    ) -> List[str]:
        """
        Generate multiple completions in parallel.
        
        Args:
            system_prompt: System prompt for all completions
            user_prompts: List of user prompts
            model: Model to use
            temperature: Temperature for generation
            max_tokens: Maximum tokens per completion
            
        Returns:
            List of generated completions
        """
        if not self.openai_client:
            logger.warning("No OpenAI client available")
            return [f"Mock response to: {prompt[:50]}..." for prompt in user_prompts]
        
        import asyncio
        
        tasks = []
        for prompt in user_prompts:
            task = self.generate_completion(
                system_prompt=system_prompt,
                user_prompt=prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )
            tasks.append(task)
        
        logger.info(f"Generating {len(tasks)} completions in parallel")
        
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    def is_available(self) -> bool:
        """
        Check if OpenAI client is available.
        
        Returns:
            True if client is available, False otherwise
        """
        return self.openai_client is not None
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the current model configuration.
        
        Returns:
            Dictionary with model configuration
        """
        return {
            "model": self.default_model,
            "temperature": self.default_temperature,
            "max_tokens": self.default_max_tokens,
            "available": self.is_available()
        }