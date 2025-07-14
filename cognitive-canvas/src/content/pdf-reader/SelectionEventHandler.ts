// SelectionEventHandler.ts - Event coordination between DOM events and FastSelection
// Handles mouse/keyboard events and delegates to FastSelection for selection operations
// NO business logic - pure event coordination and DOM interaction

import { FastSelection } from './FastSelection';
import { Selection } from './SelectionAPI';

export interface SelectionEventHandlerOptions {
  onSelectionChange?: (selection: Selection | null) => void;
  onSelectionEnd?: (selection: Selection | null) => void;
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
  private selectionCanvasCtx: CanvasRenderingContext2D | null = null;
  private containerRef: HTMLDivElement | null = null;
  
  
  // Event listeners cleanup
  private cleanup: (() => void)[] = [];

  constructor(
    fastSelection: FastSelection, 
    selectionCanvasCtx: CanvasRenderingContext2D | null = null,
    options: SelectionEventHandlerOptions = {}
  ) {
    this.fastSelection = fastSelection;
    this.options = options;
    this.selectionCanvasCtx = selectionCanvasCtx;
    
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
    // Update context if not provided in constructor
    if (!this.selectionCanvasCtx && selectionCanvas) {
      this.selectionCanvasCtx = selectionCanvas.getContext('2d');
    }
  }

  /**
   * Set container reference for scroll position access
   */
  setContainerRef(containerRef: HTMLDivElement | null): void {
    this.containerRef = containerRef;
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
    
    // Draw initial selection point immediately
    const scrollTop = this.containerRef?.scrollTop || 0;
    this.drawCurrentSelection(scrollTop);
    
    // Notify React state
    this.options.onSelectionChange?.(null);
  };

  handleMouseMove = (e: React.MouseEvent): void => {
    if (!this.isSelecting || !this.textCanvas || !this.selectionStart) return;
    
    e.preventDefault();
    
    const rect = this.textCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update selection model immediately
    this.updateSelection(x, y);
    
    // Draw selection immediately for zero-latency feedback
    const scrollTop = this.containerRef?.scrollTop || 0;
    this.drawCurrentSelection(scrollTop);
    
    // Throttle React state updates
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(() => {
      const selection = this.fastSelection.getSelection();
      this.options.onSelectionChange?.(selection);
    });
  };

  handleMouseUp = (): void => {
    this.isSelecting = false;
    this.selectionStart = null;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // Final selection update
    const finalSelection = this.fastSelection.getSelection();
    this.options.onSelectionEnd?.(finalSelection);
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
    
    // Convert viewport-relative coordinates to absolute document coordinates
    const scrollTop = this.containerRef?.scrollTop || 0;
    const anchorY = this.selectionStart.y + scrollTop;
    const focusY = y + scrollTop;
    
    // Native-like selection: simple anchor/focus model
    // Anchor is where mouse was pressed, focus is where mouse is now
    const anchorChar = this.fastSelection.coordsToChar(this.selectionStart.x, anchorY);
    const focusChar = this.fastSelection.coordsToChar(x, focusY, this.selectionStart.x, anchorY);
    
    // Set selection with proper ordering (SelectionAPI handles min/max)
    this.fastSelection.setSelection(anchorChar, focusChar);
  }

  /**
   * Draw current selection directly to canvas for zero-latency feedback
   */
  private drawCurrentSelection(scrollTop: number = 0): void {
    if (!this.selectionCanvasCtx || !this.selectionCanvas) return;
    
    const ctx = this.selectionCanvasCtx;
    
    // Clear the entire selection canvas
    ctx.clearRect(0, 0, this.selectionCanvas.width, this.selectionCanvas.height);
    
    // Get selection rectangles with scroll offset
    const rects = this.fastSelection.getSelectionRects(scrollTop);
    if (rects.length === 0) return;
    
    // Draw selection rectangles
    ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
    for (const rect of rects) {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
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
    // Convert viewport-relative coordinates to absolute document coordinates
    const scrollTop = this.containerRef?.scrollTop || 0;
    const absoluteY = y + scrollTop;
    return this.fastSelection.coordsToChar(x, absoluteY);
  }

  /**
   * SMART SELECTION OPERATIONS
   */

  selectWordAt(x: number, y: number): Selection | null {
    // Convert viewport-relative coordinates to absolute document coordinates
    const scrollTop = this.containerRef?.scrollTop || 0;
    const absoluteY = y + scrollTop;
    const offset = this.fastSelection.coordsToChar(x, absoluteY);
    return this.fastSelection.selectWordAt(offset);
  }

  selectSentenceAt(x: number, y: number): Selection | null {
    // Convert viewport-relative coordinates to absolute document coordinates
    const scrollTop = this.containerRef?.scrollTop || 0;
    const absoluteY = y + scrollTop;
    const offset = this.fastSelection.coordsToChar(x, absoluteY);
    return this.fastSelection.selectSentenceAt(offset);
  }

  selectLineAt(x: number, y: number): Selection | null {
    // Convert viewport-relative coordinates to absolute document coordinates
    const scrollTop = this.containerRef?.scrollTop || 0;
    const absoluteY = y + scrollTop;
    const offset = this.fastSelection.coordsToChar(x, absoluteY);
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