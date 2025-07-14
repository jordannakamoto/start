// FastSelection.ts - Basic UI model for interacting with the visible text
// Minimal overhead for real-time UI interactions
// Delegates all data operations to TextModel and SelectionAPI

import { TextModel } from './TextModel';
import { SelectionAPI, Selection } from './SelectionAPI';
import { HighlightAPI, Highlight, HighlightOptions } from './HighlightAPI';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * FastSelection - Basic UI model for visible text interaction
 * Provides minimal overhead interface for real-time UI operations
 * Delegates all complex operations to TextModel and SelectionAPI
 */
export class FastSelection {
  private textModel: TextModel;
  private selectionAPI: SelectionAPI;
  private highlightAPI: HighlightAPI;
  private currentSelection: Selection | null = null;
  private listeners: ((selection: Selection | null) => void)[] = [];

  constructor() {
    this.textModel = new TextModel();
    this.selectionAPI = new SelectionAPI(this.textModel);
    this.highlightAPI = new HighlightAPI(this.textModel);
    
    // Listen to SelectionAPI changes and forward primary selection
    this.selectionAPI.onSelectionChange((_selections) => {
      const primary = this.selectionAPI.getPrimarySelection();
      if (primary !== this.currentSelection) {
        this.currentSelection = primary;
        this.notifyListeners();
      }
    });
  }

  /**
   * Initialize with visual text items
   */
  init(visualItems: { str: string; x: number; y: number; width: number; height: number; }[]): void {
    this.selectionAPI.initialize(visualItems);
    this.currentSelection = null;
  }

  /**
   * BASIC UI OPERATIONS - Maximum speed
   */

  /**
   * Convert screen coordinates to character index - delegates to TextModel
   */
  coordsToChar(x: number, y: number, anchorX?: number, anchorY?: number): number {
    const offset = this.textModel.coordinatesToOffset(x, y, anchorX, anchorY);
    return offset || 0;
  }


  /**
   * Set selection by character range - delegates to SelectionAPI
   */
  setSelection(start: number, end: number): void {
    this.selectionAPI.clearSelections('user');
    this.selectionAPI.createSelection(start, end, 'user');
  }

  /**
   * Get current selection
   */
  getSelection(): Selection | null {
    return this.currentSelection;
  }

  /**
   * Get selection rectangles for GPU rendering - delegates to SelectionAPI
   */
  getSelectionRects(scrollTop: number = 0): SelectionRect[] {
    if (!this.currentSelection) return [];
    
    const bounds = this.selectionAPI.getSelectionBounds();
    return bounds.rects.map(rect => ({
      x: rect.x,
      y: rect.y - scrollTop,
      width: rect.width,
      height: rect.height
    }));
  }

  /**
   * Get selected text - delegates to SelectionAPI
   */
  getSelectedText(): string {
    return this.selectionAPI.getSelectedText();
  }

  /**
   * Clear selection - delegates to SelectionAPI
   */
  clearSelection(): void {
    this.selectionAPI.clearSelections('user');
  }

  /**
   * ADVANCED UI OPERATIONS (optional, delegates to SelectionAPI)
   */

  /**
   * Smart word selection
   */
  selectWordAt(offset: number): Selection | null {
    this.selectionAPI.clearSelections('user');
    return this.selectionAPI.selectWordAt(offset);
  }

  /**
   * Smart sentence selection
   */
  selectSentenceAt(offset: number): Selection | null {
    this.selectionAPI.clearSelections('user');
    return this.selectionAPI.selectSentenceAt(offset);
  }

  /**
   * Smart line selection
   */
  selectLineAt(offset: number): Selection | null {
    this.selectionAPI.clearSelections('user');
    return this.selectionAPI.selectLineAt(offset);
  }

  /**
   * Select all text
   */
  selectAll(): Selection | null {
    this.selectionAPI.clearSelections('user');
    return this.selectionAPI.selectAll();
  }

  /**
   * CHANGE NOTIFICATIONS
   */

  /**
   * Add selection change listener
   */
  onChange(listener: (selection: Selection | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  /**
   * DIRECT ACCESS to underlying systems (for advanced use cases)
   */

  /**
   * Get TextModel instance for direct data access
   */
  getTextModel(): TextModel {
    return this.textModel;
  }

  /**
   * Get SelectionAPI instance for advanced operations
   */
  getSelectionAPI(): SelectionAPI {
    return this.selectionAPI;
  }

  /**
   * Get HighlightAPI instance for highlight operations
   */
  getHighlightAPI(): HighlightAPI {
    return this.highlightAPI;
  }

  /**
   * HIGHLIGHT CONVENIENCE METHODS
   */

  /**
   * Highlight current selection
   */
  highlightSelection(options: HighlightOptions = {}): Highlight | null {
    const selection = this.getSelection();
    if (!selection) return null;

    return this.highlightAPI.addHighlight(selection.start, selection.end, options);
  }

  /**
   * Highlight text range
   */
  highlightRange(start: number, end: number, options: HighlightOptions = {}): Highlight {
    return this.highlightAPI.addHighlight(start, end, options);
  }

  /**
   * Remove highlight by ID
   */
  removeHighlight(id: string): boolean {
    return this.highlightAPI.removeHighlight(id);
  }

  /**
   * Get all highlights
   */
  getAllHighlights(): Highlight[] {
    return this.highlightAPI.getAllHighlights();
  }

  /**
   * Find and highlight text pattern
   */
  findAndHighlight(pattern: string | RegExp, options: HighlightOptions = {}): Highlight[] {
    return this.highlightAPI.highlightText(pattern, options);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSelection);
      } catch (error) {
        console.error('Error in FastSelection listener:', error);
      }
    }
  }
}