/**
 * Zero-Overhead Input Processor
 * 
 * Bypasses React's synthetic event system for critical input handling.
 * Provides immediate visual feedback within the same frame as input.
 */

export interface InputEvent {
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove';
  key?: string;
  code?: string;
  x?: number;
  y?: number;
  timestamp: number;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface InputHandler {
  priority: number; // Lower = higher priority
  filter: (event: InputEvent) => boolean;
  handle: (event: InputEvent) => boolean; // Return true if handled
}

export interface CursorPosition {
  line: number;
  column: number;
  offset: number;
}

export class InputProcessor {
  private handlers: InputHandler[] = [];
  private lastInputTime = 0;
  private inputBuffer: InputEvent[] = [];
  private readonly maxBufferSize = 100;
  
  
  // Performance tracking
  private inputLatency: number[] = [];
  private readonly maxLatencyRecords = 60; // 1 second at 60fps

  constructor(private element: HTMLElement) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Use capturing phase for fastest possible response
    const options = { capture: true, passive: false };

    // Keyboard events
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this), options);
    this.element.addEventListener('keyup', this.handleKeyUp.bind(this), options);
    
    // Mouse events
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this), options);
    this.element.addEventListener('mouseup', this.handleMouseUp.bind(this), options);
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this), options);
    
    // Prevent context menu for faster right-click handling
    this.element.addEventListener('contextmenu', (e) => e.preventDefault(), options);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const inputEvent = this.createInputEvent('keydown', e);
    this.processInput(inputEvent, e);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const inputEvent = this.createInputEvent('keyup', e);
    this.processInput(inputEvent, e);
  }

  private handleMouseDown(e: MouseEvent): void {
    const inputEvent = this.createInputEvent('mousedown', e);
    this.processInput(inputEvent, e);
  }

  private handleMouseUp(e: MouseEvent): void {
    const inputEvent = this.createInputEvent('mouseup', e);
    this.processInput(inputEvent, e);
  }

  private handleMouseMove(e: MouseEvent): void {
    // Throttle mouse moves to avoid overwhelming the system
    if (performance.now() - this.lastInputTime < 8) return;
    
    const inputEvent = this.createInputEvent('mousemove', e);
    this.processInput(inputEvent, e);
  }

  private createInputEvent(type: InputEvent['type'], e: KeyboardEvent | MouseEvent): InputEvent {
    const timestamp = performance.now();
    
    const inputEvent: InputEvent = {
      type,
      timestamp,
      modifiers: {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey
      }
    };

    if (e instanceof KeyboardEvent) {
      inputEvent.key = e.key;
      inputEvent.code = e.code;
    } else if (e instanceof MouseEvent) {
      const rect = this.element.getBoundingClientRect();
      inputEvent.x = e.clientX - rect.left;
      inputEvent.y = e.clientY - rect.top;
    }

    return inputEvent;
  }

  private processInput(inputEvent: InputEvent, originalEvent: Event): void {
    const processingStart = performance.now();
    
    // Add to buffer for replay/undo capabilities
    this.addToBuffer(inputEvent);
    
    // Sort handlers by priority (lower number = higher priority)
    const sortedHandlers = [...this.handlers].sort((a, b) => a.priority - b.priority);
    
    // Process through handlers until one claims it
    for (const handler of sortedHandlers) {
      if (handler.filter(inputEvent)) {
        const handled = handler.handle(inputEvent);
        if (handled) {
          originalEvent.preventDefault();
          originalEvent.stopImmediatePropagation();
          break;
        }
      }
    }
    
    // Track input processing latency
    const processingTime = performance.now() - processingStart;
    this.recordLatency(processingTime);
    
    this.lastInputTime = inputEvent.timestamp;
  }

  private addToBuffer(event: InputEvent): void {
    this.inputBuffer.push(event);
    
    // Keep buffer size manageable
    if (this.inputBuffer.length > this.maxBufferSize) {
      this.inputBuffer.shift();
    }
  }

  private recordLatency(latency: number): void {
    this.inputLatency.push(latency);
    
    if (this.inputLatency.length > this.maxLatencyRecords) {
      this.inputLatency.shift();
    }
    
    // Warn on excessive latency
    if (latency > 2) { // 2ms threshold
      console.warn(`Input processing exceeded 2ms: ${latency.toFixed(2)}ms`);
    }
  }

  // Public API
  public registerHandler(handler: InputHandler): void {
    this.handlers.push(handler);
  }

  public unregisterHandler(handler: InputHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  public getInputBuffer(): InputEvent[] {
    return [...this.inputBuffer];
  }

  public clearInputBuffer(): void {
    this.inputBuffer = [];
  }

  public getAverageLatency(): number {
    if (this.inputLatency.length === 0) return 0;
    return this.inputLatency.reduce((sum, lat) => sum + lat, 0) / this.inputLatency.length;
  }

  public getMaxLatency(): number {
    return this.inputLatency.length > 0 ? Math.max(...this.inputLatency) : 0;
  }

  public destroy(): void {
    // Remove all event listeners
    this.element.removeEventListener('keydown', this.handleKeyDown);
    this.element.removeEventListener('keyup', this.handleKeyUp);
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.element.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('mousemove', this.handleMouseMove);
    
    this.handlers = [];
    this.inputBuffer = [];
    this.inputLatency = [];
  }
}

// Utility functions for common input patterns
export const createTextInputHandler = (
  onTextInput: (char: string) => void,
  priority = 100
): InputHandler => ({
  priority,
  filter: (event) => event.type === 'keydown' && !!event.key && event.key.length === 1,
  handle: (event) => {
    if (event.key) {
      onTextInput(event.key);
      return true;
    }
    return false;
  }
});

export const createShortcutHandler = (
  shortcuts: Record<string, () => void>,
  priority = 50
): InputHandler => ({
  priority,
  filter: (event) => event.type === 'keydown',
  handle: (event) => {
    const { key, modifiers } = event;
    if (!key) return false;
    
    // Build shortcut string (e.g., "Ctrl+S", "Cmd+Shift+N")
    const parts = [];
    if (modifiers.meta) parts.push('Cmd');
    if (modifiers.ctrl) parts.push('Ctrl');
    if (modifiers.shift) parts.push('Shift');
    if (modifiers.alt) parts.push('Alt');
    parts.push(key);
    
    const shortcut = parts.join('+');
    const handler = shortcuts[shortcut];
    
    if (handler) {
      handler();
      return true;
    }
    
    return false;
  }
});

// Export singleton
let inputProcessorInstance: InputProcessor | null = null;

export const getInputProcessor = (element?: HTMLElement): InputProcessor => {
  if (!inputProcessorInstance && element) {
    inputProcessorInstance = new InputProcessor(element);
  }
  if (!inputProcessorInstance) {
    throw new Error('InputProcessor not initialized. Pass an element to getInputProcessor()');
  }
  return inputProcessorInstance;
};

export const destroyInputProcessor = (): void => {
  if (inputProcessorInstance) {
    inputProcessorInstance.destroy();
    inputProcessorInstance = null;
  }
};