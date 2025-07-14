// SelectionAPI.ts - Expanded API for deep interaction from other systems
// Uses TextModel for data, provides advanced selection operations
// NO UI logic - that belongs in FastSelection

import { TextModel } from './TextModel';

export interface Selection {
  id: string;
  start: number;
  end: number;
  type: 'user' | 'search' | 'highlight' | 'annotation' | 'smart';
  metadata?: any;
}

export interface SelectionBounds {
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    selectionId: string;
  }>;
}

/**
 * SelectionAPI - Expanded API for deep interaction from other systems
 * Delegates all data operations to TextModel
 * Provides advanced selection features for external system integration
 */
export class SelectionAPI {
  private textModel: TextModel;
  private selections: Map<string, Selection> = new Map();
  private listeners: ((selections: Map<string, Selection>) => void)[] = [];
  private nextId: number = 0;

  constructor(textModel: TextModel) {
    this.textModel = textModel;
  }

  /**
   * Initialize with text model (delegates to TextModel)
   */
  initialize(visualItems: any[]): void {
    this.textModel.buildFromVisualItems(visualItems);
    this.clearAllSelections();
  }

  /**
   * BASIC SELECTION OPERATIONS
   */

  /**
   * Create selection by character range
   */
  createSelection(start: number, end: number, type: Selection['type'] = 'user', metadata?: any): Selection {
    const selection: Selection = {
      id: `sel_${this.nextId++}`,
      start: Math.min(start, end),
      end: Math.max(start, end),
      type,
      metadata
    };

    this.selections.set(selection.id, selection);
    this.notifyListeners();
    return selection;
  }

  /**
   * Update existing selection
   */
  updateSelection(id: string, start: number, end: number): boolean {
    const selection = this.selections.get(id);
    if (!selection) return false;

    selection.start = Math.min(start, end);
    selection.end = Math.max(start, end);
    this.notifyListeners();
    return true;
  }

  /**
   * Remove selection
   */
  removeSelection(id: string): boolean {
    const removed = this.selections.delete(id);
    if (removed) this.notifyListeners();
    return removed;
  }

  /**
   * Get all selections
   */
  getSelections(): Map<string, Selection> {
    return new Map(this.selections);
  }

  /**
   * Get primary user selection
   */
  getPrimarySelection(): Selection | null {
    const userSelections = this.getSelectionsByType('user');
    return userSelections.length > 0 ? userSelections[userSelections.length - 1] : null;
  }

  /**
   * Get selections by type
   */
  getSelectionsByType(type: Selection['type']): Selection[] {
    return Array.from(this.selections.values()).filter(sel => sel.type === type);
  }

  /**
   * Clear selections (all or by type)
   */
  clearSelections(type?: Selection['type']): void {
    if (type) {
      for (const [id, selection] of this.selections) {
        if (selection.type === type) {
          this.selections.delete(id);
        }
      }
    } else {
      this.selections.clear();
    }
    this.notifyListeners();
  }

  /**
   * Clear all selections (convenience method)
   */
  clearAllSelections(): void {
    this.clearSelections();
  }

  /**
   * COORDINATE OPERATIONS (delegates to TextModel)
   */

  /**
   * Convert coordinates to character offset
   */
  coordinatesToOffset(x: number, y: number): number | null {
    return this.textModel.coordinatesToOffset(x, y);
  }

  /**
   * TEXT OPERATIONS (delegates to TextModel)
   */

  /**
   * Get text for selection
   */
  getSelectionText(selection: Selection): string {
    return this.textModel.getText(selection.start, selection.end);
  }

  /**
   * Get text for primary selection
   */
  getSelectedText(): string {
    const primary = this.getPrimarySelection();
    if (!primary) return '';
    return this.getSelectionText(primary);
  }

  /**
   * Get full document text
   */
  getDocumentText(): string {
    return this.textModel.getDocumentText();
  }

  /**
   * SMART SELECTION OPERATIONS
   */

  /**
   * Select word at offset
   */
  selectWordAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Expand to word boundaries
    while (start > 0 && !/[\s\n\t.,;!?]/.test(text[start - 1])) start--;
    while (end < text.length && !/[\s\n\t.,;!?]/.test(text[end])) end++;

    if (start === end) return null;
    return this.createSelection(start, end, 'smart');
  }

  /**
   * Select sentence at offset
   */
  selectSentenceAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Find sentence boundaries
    while (start > 0 && !/[.!?]/.test(text[start - 1])) start--;
    while (start < text.length && /\s/.test(text[start])) start++; // Skip leading whitespace

    while (end < text.length && !/[.!?]/.test(text[end])) end++;
    if (end < text.length) end++; // Include the punctuation

    return this.createSelection(start, end, 'smart');
  }

  /**
   * Select line at offset
   */
  selectLineAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Find line boundaries
    while (start > 0 && text[start - 1] !== '\n') start--;
    while (end < text.length && text[end] !== '\n') end++;

    return this.createSelection(start, end, 'smart');
  }

  /**
   * Select all text
   */
  selectAll(): Selection | null {
    const text = this.textModel.getDocumentText();
    if (text.length === 0) return null;
    return this.createSelection(0, text.length, 'smart');
  }

  /**
   * ADVANCED OPERATIONS FOR EXTERNAL SYSTEMS
   */

  /**
   * Find text patterns and create selections
   */
  findText(pattern: string | RegExp, type: Selection['type'] = 'search'): Selection[] {
    const text = this.textModel.getDocumentText();
    const matches: Selection[] = [];

    if (typeof pattern === 'string') {
      let index = 0;
      while ((index = text.indexOf(pattern, index)) !== -1) {
        const selection = this.createSelection(index, index + pattern.length, type);
        matches.push(selection);
        index += pattern.length;
      }
    } else {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const selection = this.createSelection(match.index, match.index + match[0].length, type);
        matches.push(selection);
        if (!pattern.global) break;
      }
    }

    return matches;
  }

  /**
   * Select text in coordinate region
   */
  selectInRegion(x1: number, y1: number, x2: number, y2: number): Selection[] {
    const items = this.textModel.getItemsInRegion(x1, y1, x2, y2);
    const selections: Selection[] = [];

    if (items.length === 0) return selections;

    // Group continuous character ranges
    const ranges = items.map(item => ({ start: item.charStart, end: item.charEnd }))
      .sort((a, b) => a.start - b.start);
    
    // Merge adjacent ranges
    const merged = [];
    for (const range of ranges) {
      if (merged.length === 0 || merged[merged.length - 1].end < range.start) {
        merged.push(range);
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, range.end);
      }
    }

    // Create selections for each merged range
    for (const range of merged) {
      const selection = this.createSelection(range.start, range.end, 'user');
      selections.push(selection);
    }

    return selections;
  }

  /**
   * Get overlapping selections
   */
  findOverlapping(start: number, end: number): Selection[] {
    return Array.from(this.selections.values()).filter(sel =>
      !(sel.end <= start || sel.start >= end) // Not disjoint = overlapping
    );
  }

  /**
   * Merge overlapping selections
   */
  mergeOverlapping(): void {
    const selections = Array.from(this.selections.values()).sort((a, b) => a.start - b.start);
    const merged: Selection[] = [];

    for (const selection of selections) {
      if (merged.length === 0 || merged[merged.length - 1].end < selection.start) {
        merged.push({ ...selection });
      } else {
        const last = merged[merged.length - 1];
        last.end = Math.max(last.end, selection.end);
      }
    }

    // Replace with merged selections
    this.selections.clear();
    for (const selection of merged) {
      this.selections.set(selection.id, selection);
    }
    this.notifyListeners();
  }

  /**
   * RENDERING SUPPORT (for UI systems)
   */

  /**
   * Get selection bounds for rendering
   */
  getSelectionBounds(): SelectionBounds {
    const allRects: SelectionBounds['rects'] = [];

    for (const [id, selection] of this.selections) {
      const rects = this.generateSelectionRects(selection);
      allRects.push(...rects.map(rect => ({ ...rect, selectionId: id })));
    }

    return { rects: allRects };
  }

  /**
   * CHANGE NOTIFICATIONS
   */

  /**
   * Add selection change listener
   */
  onSelectionChange(listener: (selections: Map<string, Selection>) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(new Map(this.selections));
      } catch (error) {
        console.error('Error in selection change listener:', error);
      }
    }
  }

  private generateSelectionRects(selection: Selection): Array<{ x: number; y: number; width: number; height: number; }> {
    const rects: Array<{ x: number; y: number; width: number; height: number; }> = [];
    let currentRect: { x: number; y: number; width: number; height: number; } | null = null;
    let lastItem: any = null;

    for (let i = selection.start; i < selection.end; i++) {
      const item = this.textModel.getItemAt(i);
      if (!item) continue;

      const charInItem = i - item.charStart;
      const charWidth = item.width / item.str.length;
      const charX = item.x + charInItem * charWidth;
      const charY = item.y - item.height * 0.8;
      const charHeight = item.height * 1.2;

      // Try to extend current rectangle
      if (currentRect && 
          lastItem === item && 
          Math.abs(currentRect.y - charY) < 2) {
        currentRect.width = charX + charWidth - currentRect.x;
      } else {
        // Start new rectangle
        if (currentRect) rects.push(currentRect);
        currentRect = {
          x: charX,
          y: charY,
          width: charWidth,
          height: charHeight
        };
      }

      lastItem = item;
    }

    if (currentRect) rects.push(currentRect);
    return rects;
  }
}