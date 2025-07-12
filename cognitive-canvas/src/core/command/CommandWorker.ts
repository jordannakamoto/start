/**
 * Command Worker
 * 
 * Executes heavy commands off the main thread to maintain UI responsiveness.
 */

import type { Command, CommandResult } from './CommandProcessor';

// Define worker command handlers
interface WorkerCommandHandler {
  type: string;
  execute: (payload: any) => Promise<any>;
}

const handlers: Map<string, WorkerCommandHandler> = new Map();

// Text processing commands
handlers.set('text.process', {
  type: 'text.process',
  execute: async (payload: { text: string; operation: string }) => {
    const { text, operation } = payload;
    
    switch (operation) {
      case 'wordCount':
        return { count: text.split(/\s+/).filter(word => word.length > 0).length };
      
      case 'spellCheck':
        // Simulate spell checking (in real implementation, use a spell check library)
        const words = text.split(/\s+/);
        const misspelled = words.filter(word => word.length > 10); // Simple mock
        return { misspelled };
      
      case 'compress':
        // Simulate text compression
        return { compressed: text.replace(/\s+/g, ' ').trim() };
      
      default:
        throw new Error(`Unknown text operation: ${operation}`);
    }
  }
});

// Document serialization
handlers.set('document.serialize', {
  type: 'document.serialize',
  execute: async (payload: { documentState: any; format: string }) => {
    const { documentState, format } = payload;
    
    const startTime = performance.now();
    
    let serialized: string;
    switch (format) {
      case 'json':
        serialized = JSON.stringify(documentState);
        break;
      
      case 'markdown':
        // Convert document state to markdown (simplified)
        serialized = JSON.stringify(documentState); // Mock implementation
        break;
      
      default:
        throw new Error(`Unknown format: ${format}`);
    }
    
    const processingTime = performance.now() - startTime;
    
    return {
      data: serialized,
      size: serialized.length,
      processingTime
    };
  }
});

// Search operations
handlers.set('search.index', {
  type: 'search.index',
  execute: async (payload: { documents: any[]; query: string }) => {
    const { documents, query } = payload;
    
    // Simple text search implementation
    const results = documents.filter(doc => 
      doc.content.toLowerCase().includes(query.toLowerCase())
    ).map(doc => ({
      id: doc.id,
      title: doc.title,
      score: (doc.content.match(new RegExp(query, 'gi')) || []).length
    }));
    
    return { results: results.sort((a, b) => b.score - a.score) };
  }
});

// File operations
handlers.set('file.process', {
  type: 'file.process',
  execute: async (payload: { content: string; operation: string }) => {
    const { content, operation } = payload;
    
    switch (operation) {
      case 'validate':
        try {
          JSON.parse(content);
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid JSON' };
        }
      
      case 'analyze':
        return {
          size: content.length,
          lines: content.split('\n').length,
          characters: content.length,
          words: content.split(/\s+/).filter(w => w.length > 0).length
        };
      
      default:
        throw new Error(`Unknown file operation: ${operation}`);
    }
  }
});

// Worker message handler
self.onmessage = async (event: MessageEvent) => {
  const { command }: { command: Command } = event.data;
  
  const startTime = performance.now();
  
  try {
    const handler = handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler found for command type: ${command.type}`);
    }
    
    const data = await handler.execute(command.payload);
    const executionTime = performance.now() - startTime;
    
    const result: CommandResult = {
      success: true,
      data,
      executionTime
    };
    
    self.postMessage({
      commandId: command.id,
      result
    });
    
  } catch (error) {
    const executionTime = performance.now() - startTime;
    
    const result: CommandResult = {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      executionTime
    };
    
    self.postMessage({
      commandId: command.id,
      result
    });
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('Command worker error:', error);
};

export {};