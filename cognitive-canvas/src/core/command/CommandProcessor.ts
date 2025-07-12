/**
 * Async-First Command Processor
 * 
 * All heavy operations are offloaded from the UI thread with optimistic updates.
 * Provides command queuing, prioritization, and rollback capabilities.
 */

export interface Command<T = any> {
  id: string;
  type: string;
  payload: T;
  priority: CommandPriority;
  timestamp: number;
  optimistic?: OptimisticUpdate;
  rollback?: RollbackOperation;
}

export enum CommandPriority {
  IMMEDIATE = 0,    // Input processing, cursor movement
  HIGH = 1,         // Text insertion, deletion
  NORMAL = 2,       // File operations, formatting
  LOW = 3,          // Background sync, analytics
  BACKGROUND = 4    // Cleanup, optimization
}

export interface OptimisticUpdate {
  apply: () => void;
  revert: () => void;
  description: string;
}

export interface RollbackOperation {
  execute: () => Promise<void>;
  description: string;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  executionTime: number;
}

export interface CommandHandler<T = any> {
  type: string;
  execute: (command: Command<T>) => Promise<CommandResult<T>>;
  canExecute?: (command: Command<T>) => boolean;
  weight: number; // Estimated execution time in ms
}

export interface CommandQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageExecutionTime: number;
  queueLatency: number;
}

export class CommandProcessor {
  private commandQueue: Command[] = [];
  private processingQueue: Map<string, Command> = new Map();
  private handlers: Map<string, CommandHandler> = new Map();
  private workers: Worker[] = [];
  private isProcessing = false;
  private stats: CommandQueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    averageExecutionTime: 0,
    queueLatency: 0
  };
  
  private readonly maxConcurrentCommands = 4;
  private readonly workerCount = navigator.hardwareConcurrency || 4;
  
  constructor() {
    this.initializeWorkers();
    this.startProcessingLoop();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(
        new URL('./CommandWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      worker.onmessage = this.handleWorkerMessage.bind(this);
      worker.onerror = this.handleWorkerError.bind(this);
      
      this.workers.push(worker);
    }
  }

  private startProcessingLoop(): void {
    const process = () => {
      if (!this.isProcessing) {
        this.processCommandQueue();
      }
      
      // Schedule next processing cycle
      setTimeout(process, 16); // Ensure sub-frame processing
    };
    
    process();
  }

  private async processCommandQueue(): Promise<void> {
    if (this.processingQueue.size >= this.maxConcurrentCommands || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    // Sort by priority and timestamp
    this.commandQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });

    const command = this.commandQueue.shift();
    if (!command) {
      this.isProcessing = false;
      return;
    }

    await this.executeCommand(command);
    this.isProcessing = false;
    
    // Continue processing if there are more commands
    if (this.commandQueue.length > 0) {
      this.processCommandQueue();
    }
  }

  private async executeCommand(command: Command): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      console.error(`No handler found for command type: ${command.type}`);
      this.stats.failed++;
      return;
    }

    // Check if command can be executed
    if (handler.canExecute && !handler.canExecute(command)) {
      console.warn(`Command cannot be executed: ${command.type}`);
      this.stats.failed++;
      return;
    }

    // Apply optimistic update immediately
    if (command.optimistic) {
      try {
        command.optimistic.apply();
      } catch (error) {
        console.error('Optimistic update failed:', error);
      }
    }

    this.processingQueue.set(command.id, command);
    this.stats.processing++;
    
    const startTime = performance.now();
    
    try {
      // Execute command (potentially in worker)
      const result = await this.executeInWorkerOrMain(command, handler);
      
      const executionTime = performance.now() - startTime;
      this.updateExecutionStats(executionTime);
      
      if (result.success) {
        this.stats.completed++;
      } else {
        this.stats.failed++;
        
        // Revert optimistic update on failure
        if (command.optimistic) {
          command.optimistic.revert();
        }
        
        // Execute rollback if available
        if (command.rollback) {
          await command.rollback.execute();
        }
      }
      
    } catch (error) {
      console.error(`Command execution failed: ${command.type}`, error);
      this.stats.failed++;
      
      // Revert optimistic update
      if (command.optimistic) {
        command.optimistic.revert();
      }
    } finally {
      this.processingQueue.delete(command.id);
      this.stats.processing--;
    }
  }

  private async executeInWorkerOrMain(
    command: Command,
    handler: CommandHandler
  ): Promise<CommandResult> {
    // For heavy operations, use worker
    if (handler.weight > 5) {
      return this.executeInWorker(command);
    }
    
    // For light operations, execute in main thread
    return handler.execute(command);
  }

  private executeInWorker(command: Command): Promise<CommandResult> {
    return new Promise((resolve) => {
      // Find available worker (simple round-robin)
      const worker = this.workers[command.timestamp % this.workers.length];
      
      const messageHandler = (event: MessageEvent) => {
        if (event.data.commandId === command.id) {
          worker.removeEventListener('message', messageHandler);
          resolve(event.data.result);
        }
      };
      
      worker.addEventListener('message', messageHandler);
      worker.postMessage({ command });
    });
  }

  private handleWorkerMessage(): void {
    // Worker message handling is done in executeInWorker
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);
  }

  private updateExecutionStats(executionTime: number): void {
    const total = this.stats.completed + this.stats.failed;
    this.stats.averageExecutionTime = 
      (this.stats.averageExecutionTime * (total - 1) + executionTime) / total;
  }

  // Public API
  public async execute<T>(command: Omit<Command<T>, 'id' | 'timestamp'>): Promise<string> {
    const fullCommand: Command<T> = {
      ...command,
      id: this.generateCommandId(),
      timestamp: performance.now()
    };

    this.commandQueue.push(fullCommand);
    this.stats.pending++;
    
    // Start processing if not already running
    if (!this.isProcessing) {
      setTimeout(() => this.processCommandQueue(), 0);
    }
    
    return fullCommand.id;
  }

  public registerHandler<T>(handler: CommandHandler<T>): void {
    this.handlers.set(handler.type, handler);
  }

  public unregisterHandler(type: string): void {
    this.handlers.delete(type);
  }

  public cancelCommand(commandId: string): boolean {
    // Remove from queue if not yet processing
    const index = this.commandQueue.findIndex(cmd => cmd.id === commandId);
    if (index !== -1) {
      this.commandQueue.splice(index, 1);
      this.stats.pending--;
      return true;
    }
    
    // Cannot cancel if already processing
    return false;
  }

  public getQueueStats(): CommandQueueStats {
    return { ...this.stats };
  }

  public getQueueLength(): number {
    return this.commandQueue.length;
  }

  public clearQueue(): void {
    this.commandQueue = [];
    this.stats.pending = 0;
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public destroy(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.commandQueue = [];
    this.processingQueue.clear();
    this.handlers.clear();
  }
}

// Pre-built command types for common operations
export const CommandTypes = {
  TEXT_INSERT: 'text.insert',
  TEXT_DELETE: 'text.delete',
  DOCUMENT_SAVE: 'document.save',
  DOCUMENT_LOAD: 'document.load',
  SEARCH_QUERY: 'search.query',
  FORMAT_APPLY: 'format.apply',
  UNDO: 'history.undo',
  REDO: 'history.redo'
} as const;

// Utility function to create optimistic text insertion
export const createOptimisticTextInsert = (
  position: number,
  text: string,
  updateUI: (text: string) => void,
  revertUI: () => void
): OptimisticUpdate => ({
  apply: () => updateUI(text),
  revert: revertUI,
  description: `Insert "${text}" at position ${position}`
});

// Export singleton
let commandProcessorInstance: CommandProcessor | null = null;

export const getCommandProcessor = (): CommandProcessor => {
  if (!commandProcessorInstance) {
    commandProcessorInstance = new CommandProcessor();
  }
  return commandProcessorInstance;
};

export const destroyCommandProcessor = (): void => {
  if (commandProcessorInstance) {
    commandProcessorInstance.destroy();
    commandProcessorInstance = null;
  }
};