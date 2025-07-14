// SelectionEventHandler.ts - Event coordination between DOM events and FastSelection
// Handles mouse/keyboard events and delegates to FastSelection for selection operations
// NO business logic - pure event coordination and DOM interaction

import { FastSelection } from './FastSelection';
import { Selection } from './SelectionAPI';

export interface SelectionEventHandlerOptions {
  onSelectionChange?: (selection: Selection | null) => void;
  onTextCopy?: (text: string) => void;
}

/**
 * SelectionEventHandler - Coordinates DOM events with FastSelection system
 * Provides clean separation between DOM event handling and selection logic
 */
export class SelectionEventHandler {
  private fastSelection: FastSelection;
  private options: SelectionEventHandlerOptions;
  
  // Event state
  private isSelecting: boolean = false;
  private selectionStart: { x: number; y: number } | null = null;
  private animationFrame: number | null = null;
  
  // Canvas references
  private textCanvas: HTMLCanvasElement | null = null;
  private selectionCanvas: HTMLCanvasElement | null = null;
  
  // Event listeners cleanup
  private cleanup: (() => void)[] = [];

  constructor(fastSelection: FastSelection, options: SelectionEventHandlerOptions = {}) {
    this.fastSelection = fastSelection;
    this.options = options;
    
    // Listen to selection changes from FastSelection
    const unsubscribe = this.fastSelection.onChange((selection) => {
      this.options.onSelectionChange?.(selection);
    });
    this.cleanup.push(unsubscribe);
  }

  /**
   * Initialize with canvas elements
   */
  setCanvasElements(textCanvas: HTMLCanvasElement, selectionCanvas: HTMLCanvasElement): void {
    this.textCanvas = textCanvas;
    this.selectionCanvas = selectionCanvas;
  }

  /**
   * MOUSE EVENT HANDLERS
   */

  handleMouseDown = (e: React.MouseEvent): void => {
    if (!this.textCanvas) return;
    
    // Prevent browser selection
    e.preventDefault();
    e.stopPropagation();
    
    // Clear browser selection
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
    
    const rect = this.textCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Start selection
    this.isSelecting = true;
    this.selectionStart = { x, y };
    this.fastSelection.clearSelection();
  };

  handleMouseMove = (e: React.MouseEvent): void => {
    if (!this.isSelecting || !this.textCanvas || !this.selectionStart) return;
    
    e.preventDefault();
    
    // Throttle with requestAnimationFrame for performance
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(() => {
      if (!this.textCanvas || !this.selectionStart) return;
      
      const rect = this.textCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.updateSelection(x, y);
    });
  };

  handleMouseUp = (): void => {
    this.isSelecting = false;
    this.selectionStart = null;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  };

  handleMouseLeave = (): void => {
    this.handleMouseUp();
  };

  handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
  };

  /**
   * KEYBOARD EVENT HANDLERS
   */

  handleKeyDown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const selection = this.fastSelection.getSelection();
      if (selection) {
        const text = this.fastSelection.getSelectedText();
        navigator.clipboard.writeText(text);
        this.options.onTextCopy?.(text);
      }
    }
  };

  /**
   * COORDINATE CONVERSION
   */

  private updateSelection(x: number, y: number): void {
    if (!this.selectionStart) return;
    
    const startChar = this.fastSelection.coordsToChar(this.selectionStart.x, this.selectionStart.y);
    const endChar = this.fastSelection.coordsToChar(x, y);
    
    // Set selection immediately for fast response
    this.fastSelection.setSelection(startChar, endChar);
  }

  /**
   * PUBLIC CONVENIENCE METHODS
   */

  /**
   * Get current selection
   */
  getSelection(): Selection | null {
    return this.fastSelection.getSelection();
  }

  /**
   * Get selected text
   */
  getSelectedText(): string {
    return this.fastSelection.getSelectedText();
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    this.fastSelection.clearSelection();
  }

  /**
   * Convert screen coordinates to character index
   */
  coordsToChar(x: number, y: number): number {
    return this.fastSelection.coordsToChar(x, y);
  }

  /**
   * SMART SELECTION OPERATIONS
   */

  selectWordAt(x: number, y: number): Selection | null {
    const offset = this.coordsToChar(x, y);
    return this.fastSelection.selectWordAt(offset);
  }

  selectSentenceAt(x: number, y: number): Selection | null {
    const offset = this.coordsToChar(x, y);
    return this.fastSelection.selectSentenceAt(offset);
  }

  selectLineAt(x: number, y: number): Selection | null {
    const offset = this.coordsToChar(x, y);
    return this.fastSelection.selectLineAt(offset);
  }

  selectAll(): Selection | null {
    return this.fastSelection.selectAll();
  }

  /**
   * LIFECYCLE MANAGEMENT
   */

  /**
   * Setup global event listeners
   */
  setupGlobalListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    this.cleanup.push(() => {
      document.removeEventListener('keydown', this.handleKeyDown);
    });
  }

  /**
   * Cleanup all event listeners and resources
   */
  destroy(): void {
    // Cancel any pending animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Reset state
    this.isSelecting = false;
    this.selectionStart = null;
    
    // Run all cleanup functions
    for (const cleanupFn of this.cleanup) {
      try {
        cleanupFn();
      } catch (error) {
        console.error('Error during SelectionEventHandler cleanup:', error);
      }
    }
    this.cleanup = [];
  }

  /**
   * DIRECT ACCESS to FastSelection (for advanced use cases)
   */

  getFastSelection(): FastSelection {
    return this.fastSelection;
  }
}