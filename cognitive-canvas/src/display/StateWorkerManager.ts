// State Worker Manager - Handles web worker communication
// Provides fast, non-blocking state persistence

interface StateWorkerMessage {
  type: string;
  data: any;
}

class StateWorkerManager {
  private worker: Worker | null = null;
  private isReady = false;
  private messageQueue: StateWorkerMessage[] = [];

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker('/state-worker.js');
      
      this.worker.onmessage = (e) => {
        this.handleWorkerMessage(e.data);
      };
      
      this.worker.onerror = (error) => {
        console.error('State worker error:', error);
        this.isReady = false;
      };
      
    } catch (error) {
      console.error('Failed to create state worker:', error);
      // Fallback: work without worker
      this.isReady = false;
    }
  }

  private handleWorkerMessage(message: StateWorkerMessage): void {
    const { type, data } = message;
    
    switch (type) {
      case 'WORKER_READY':
        this.isReady = true;
        this.processMessageQueue();
        break;
        
      case 'SAVE_TO_STORAGE':
        // Worker can't access localStorage, so we do it here
        try {
          localStorage.setItem(data.key, data.value);
        } catch (error) {
          console.error('Failed to save to localStorage:', error);
        }
        break;
        
      case 'LOAD_FROM_STORAGE':
        // Worker requested data from localStorage
        try {
          const value = localStorage.getItem(data.key);
          this.worker?.postMessage({
            type: 'STORAGE_DATA',
            data: { key: data.key, value }
          });
          
          // Also notify any listeners
          if (value && this.onStateLoaded) {
            this.onStateLoaded(JSON.parse(value));
          }
        } catch (error) {
          console.error('Failed to load from localStorage:', error);
        }
        break;
        
      case 'CLEAR_FROM_STORAGE':
        try {
          localStorage.removeItem(data.key);
        } catch (error) {
          console.error('Failed to clear localStorage:', error);
        }
        break;
        
      case 'SAVE_COMPLETE':
        // Optional: notify of successful save
        if (process.env.NODE_ENV === 'development') {
          console.log('💾 State saved via worker');
        }
        break;
        
      case 'SAVE_ERROR':
      case 'LOAD_ERROR':
      case 'CLEAR_ERROR':
        console.error('Worker operation error:', data.error);
        break;
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private sendMessage(message: StateWorkerMessage): void {
    if (this.isReady && this.worker) {
      this.worker.postMessage(message);
    } else {
      // Queue message if worker not ready
      this.messageQueue.push(message);
    }
  }

  // Public API
  public onStateLoaded: ((state: any) => void) | null = null;

  public saveState(state: any): void {
    this.sendMessage({
      type: 'SAVE_STATE',
      data: state
    });
  }

  public loadState(): void {
    this.sendMessage({
      type: 'LOAD_STATE',
      data: {}
    });
  }

  public clearState(): void {
    this.sendMessage({
      type: 'CLEAR_STATE',
      data: {}
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }

  // Fallback for when worker is not available
  public saveStateSync(state: any): void {
    try {
      localStorage.setItem('cognitive-canvas-display', JSON.stringify(state));
    } catch (error) {
      console.error('Fallback save failed:', error);
    }
  }

  public loadStateSync(): any {
    try {
      const stored = localStorage.getItem('cognitive-canvas-display');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Fallback load failed:', error);
      return null;
    }
  }
}

// Export singleton
export const stateWorkerManager = new StateWorkerManager();