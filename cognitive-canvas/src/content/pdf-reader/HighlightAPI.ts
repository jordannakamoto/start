  // HighlightAPI.ts - Multi-highlight management system for PDF documents
// Supports multiple highlight colors, persistence, and external service integration

import { TextModel, TrivialCanvas } from './TextModel';

export interface Highlight {
  id: string;
  start: number;
  end: number;
  color: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  highlightId: string;
}

export interface HighlightOptions {
  color?: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface HighlightChangeEvent {
  type: 'added' | 'updated' | 'removed' | 'cleared';
  highlight?: Highlight;
  highlights?: Highlight[];
}

export type HighlightListener = (event: HighlightChangeEvent) => void;

// Predefined highlight colors
export const HIGHLIGHT_COLORS = {
  YELLOW: '#FFFF0080',
  GREEN: '#00FF0080', 
  BLUE: '#0080FF80',
  PINK: '#FF00FF80',
  ORANGE: '#FF800080',
  RED: '#FF000080',
  PURPLE: '#8000FF80',
  GRAY: '#80808080'
} as const;

/**
 * HighlightAPI - Manages multiple highlights throughout the PDF document
 * Designed for external service integration and persistence
 */
export class HighlightAPI {
  private textModel: TextModel;
  private highlights: Map<string, Highlight> = new Map();
  private listeners: HighlightListener[] = [];
  private nextId: number = 0;
  
  constructor(textModel: TextModel) {
    this.textModel = textModel;
  }

  /**
   * CORE HIGHLIGHT OPERATIONS
   */

  /**
   * Add a new highlight
   */
  addHighlight(start: number, end: number, options: HighlightOptions = {}): Highlight {
    const id = `highlight_${Date.now()}_${this.nextId++}`;
    const now = new Date();
    
    const highlight: Highlight = {
      id,
      start: Math.min(start, end),
      end: Math.max(start, end),
      color: options.color || HIGHLIGHT_COLORS.YELLOW,
      note: options.note,
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata
    };

    this.highlights.set(id, highlight);
    this.notifyListeners({
      type: 'added',
      highlight
    });

    return highlight;
  }

  /**
   * Update existing highlight
   */
  updateHighlight(id: string, updates: Partial<Pick<Highlight, 'color' | 'note' | 'metadata'>>): boolean {
    const highlight = this.highlights.get(id);
    if (!highlight) return false;

    const updatedHighlight = {
      ...highlight,
      ...updates,
      updatedAt: new Date()
    };

    this.highlights.set(id, updatedHighlight);
    this.notifyListeners({
      type: 'updated',
      highlight: updatedHighlight
    });

    return true;
  }

  /**
   * Remove highlight by ID
   */
  removeHighlight(id: string): boolean {
    const highlight = this.highlights.get(id);
    if (!highlight) return false;

    this.highlights.delete(id);
    this.notifyListeners({
      type: 'removed',
      highlight
    });

    return true;
  }

  /**
   * Remove highlights by range
   */
  removeHighlightsInRange(start: number, end: number): Highlight[] {
    const removed: Highlight[] = [];
    
    for (const [id, highlight] of this.highlights) {
      // Check if highlight overlaps with range
      if (!(highlight.end <= start || highlight.start >= end)) {
        this.highlights.delete(id);
        removed.push(highlight);
      }
    }

    if (removed.length > 0) {
      this.notifyListeners({
        type: 'removed',
        highlights: removed
      });
    }

    return removed;
  }

  /**
   * Clear all highlights
   */
  clearAllHighlights(): void {
    const allHighlights = Array.from(this.highlights.values());
    this.highlights.clear();
    
    this.notifyListeners({
      type: 'cleared',
      highlights: allHighlights
    });
  }

  /**
   * QUERY OPERATIONS
   */

  /**
   * Get highlight by ID
   */
  getHighlight(id: string): Highlight | null {
    return this.highlights.get(id) || null;
  }

  /**
   * Get all highlights
   */
  getAllHighlights(): Highlight[] {
    return Array.from(this.highlights.values()).sort((a, b) => a.start - b.start);
  }

  /**
   * Get highlights in range
   */
  getHighlightsInRange(start: number, end: number): Highlight[] {
    const result: Highlight[] = [];
    
    for (const highlight of this.highlights.values()) {
      // Check if highlight overlaps with range
      if (!(highlight.end <= start || highlight.start >= end)) {
        result.push(highlight);
      }
    }

    return result.sort((a, b) => a.start - b.start);
  }

  /**
   * Get highlights by color
   */
  getHighlightsByColor(color: string): Highlight[] {
    return Array.from(this.highlights.values())
      .filter(highlight => highlight.color === color)
      .sort((a, b) => a.start - b.start);
  }

  /**
   * Get highlights with notes
   */
  getHighlightsWithNotes(): Highlight[] {
    return Array.from(this.highlights.values())
      .filter(highlight => highlight.note && highlight.note.trim().length > 0)
      .sort((a, b) => a.start - b.start);
  }

  /**
   * Find highlights containing position
   */
  getHighlightsAtPosition(position: number): Highlight[] {
    return Array.from(this.highlights.values())
      .filter(highlight => position >= highlight.start && position < highlight.end)
      .sort((a, b) => a.start - b.start);
  }

  /**
   * RENDERING SUPPORT
   */

  /**
   * Get highlight rectangles for rendering
   */
  getHighlightRects(scrollTop: number = 0): HighlightRect[] {
    const allRects: HighlightRect[] = [];

    for (const highlight of this.highlights.values()) {
      const rects = this.generateHighlightRects(highlight, scrollTop);
      allRects.push(...rects);
    }

    return allRects;
  }

  /**
   * Get highlight rectangles for specific highlight
   */
  getHighlightRectsById(id: string, scrollTop: number = 0): HighlightRect[] {
    const highlight = this.highlights.get(id);
    if (!highlight) return [];

    return this.generateHighlightRects(highlight, scrollTop);
  }

  /**
   * Generate rectangles for a highlight
   */
  private generateHighlightRects(highlight: Highlight, scrollTop: number): HighlightRect[] {
    const rects: HighlightRect[] = [];
    const ctx = TrivialCanvas.getContext();
    if (!ctx) return [];

    // Collect all unique TextItems covered by the highlight
    const relevantItems = new Set<any>();
    for (let i = highlight.start; i < highlight.end; i++) {
      const item = this.textModel.getItemAt(i);
      if (item) relevantItems.add(item);
    }

    // Generate a precise rectangle for the highlighted portion of each item
    for (const item of relevantItems) {
      ctx.font = `${item.fontSize}px ${item.fontFamily}`;

      const selStartInItem = Math.max(0, highlight.start - item.charStart);
      const selEndInItem = Math.min(item.str.length, highlight.end - item.charStart);
      
      if (selStartInItem >= selEndInItem) continue;

      // Measure the pixel offset to the start of the highlight within this item
      const startOffset = ctx.measureText(item.str.substring(0, selStartInItem)).width;

      // Measure the width of the highlighted text segment itself
      const selectedStrSegment = item.str.substring(selStartInItem, selEndInItem);
      const selectedWidth = ctx.measureText(selectedStrSegment).width;

      rects.push({
        x: item.x + startOffset,
        y: item.y - item.height - scrollTop,
        width: selectedWidth,
        height: item.height * 1.2,
        color: highlight.color,
        highlightId: highlight.id
      });
    }

    return this.mergeAdjacentRects(rects);
  }

  /**
   * Merge adjacent rectangles on the same line for cleaner rendering - COPIED FROM WORKING SELECTION LOGIC
   */
  private mergeAdjacentRects(rects: HighlightRect[]): HighlightRect[] {
    if (rects.length <= 1) return rects;

    const merged: HighlightRect[] = [];
    const lineMap = new Map<number, HighlightRect[]>();

    // Group rectangles by line (using their Y coordinate with a tolerance) - SAME AS SELECTION
    for (const rect of rects) {
      const lineKey = Math.round(rect.y / 5) * 5; // Grouping by 5px vertical tolerance
      if (!lineMap.has(lineKey)) lineMap.set(lineKey, []);
      lineMap.get(lineKey)!.push(rect);
    }

    // For each line, merge adjacent rectangles - SAME AS SELECTION
    for (const lineRects of lineMap.values()) {
      lineRects.sort((a, b) => a.x - b.x);
      let currentRect = { ...lineRects[0] };
      for (let i = 1; i < lineRects.length; i++) {
        const nextRect = lineRects[i];
        // If next rectangle touches or overlaps the current one, merge them - SAME AS SELECTION
        if (nextRect.x <= currentRect.x + currentRect.width + 2) { // 2px tolerance for gaps
          const newWidth = (nextRect.x + nextRect.width) - currentRect.x;
          currentRect.width = newWidth;
        } else {
          merged.push(currentRect);
          currentRect = { ...nextRect };
        }
      }
      merged.push(currentRect);
    }

    return merged;
  }

  /**
   * TEXT OPERATIONS
   */

  /**
   * Get highlighted text for specific highlight
   */
  getHighlightText(id: string): string {
    const highlight = this.highlights.get(id);
    if (!highlight) return '';

    return this.textModel.getText(highlight.start, highlight.end);
  }

  /**
   * Get all highlighted text segments
   */
  getAllHighlightedText(): Array<{ highlight: Highlight; text: string }> {
    return Array.from(this.highlights.values()).map(highlight => ({
      highlight,
      text: this.textModel.getText(highlight.start, highlight.end)
    }));
  }

  /**
   * EXTERNAL SERVICE INTEGRATION
   */

  /**
   * Export highlights for external services
   */
  exportHighlights(): Array<Highlight & { text: string }> {
    return Array.from(this.highlights.values()).map(highlight => ({
      ...highlight,
      text: this.textModel.getText(highlight.start, highlight.end)
    }));
  }

  /**
   * Import highlights from external services
   */
  importHighlights(highlights: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>[]): Highlight[] {
    const imported: Highlight[] = [];

    for (const highlightData of highlights) {
      const highlight = this.addHighlight(highlightData.start, highlightData.end, {
        color: highlightData.color,
        note: highlightData.note,
        metadata: highlightData.metadata
      });
      imported.push(highlight);
    }

    return imported;
  }

  /**
   * Bulk operations for external services
   */
  bulkAddHighlights(ranges: Array<{ start: number; end: number; options?: HighlightOptions }>): Highlight[] {
    const added: Highlight[] = [];

    for (const range of ranges) {
      const highlight = this.addHighlight(range.start, range.end, range.options);
      added.push(highlight);
    }

    return added;
  }

  /**
   * SEARCH AND HIGHLIGHT
   */

  /**
   * Find and highlight text pattern
   */
  highlightText(pattern: string | RegExp, options: HighlightOptions = {}): Highlight[] {
    const text = this.textModel.getDocumentText();
    const highlights: Highlight[] = [];

    if (typeof pattern === 'string') {
      let index = 0;
      while ((index = text.indexOf(pattern, index)) !== -1) {
        const highlight = this.addHighlight(index, index + pattern.length, options);
        highlights.push(highlight);
        index += pattern.length;
      }
    } else {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const highlight = this.addHighlight(match.index, match.index + match[0].length, options);
        highlights.push(highlight);
        if (!pattern.global) break;
      }
    }

    return highlights;
  }

  /**
   * Remove highlights matching text pattern
   */
  removeHighlightsByText(pattern: string | RegExp): Highlight[] {
    const text = this.textModel.getDocumentText();
    const toRemove: string[] = [];

    // Find highlights that match the pattern
    for (const [id, highlight] of this.highlights) {
      const highlightText = text.slice(highlight.start, highlight.end);
      
      if (typeof pattern === 'string') {
        if (highlightText.includes(pattern)) {
          toRemove.push(id);
        }
      } else {
        if (pattern.test(highlightText)) {
          toRemove.push(id);
        }
      }
    }

    // Remove matched highlights
    const removed: Highlight[] = [];
    for (const id of toRemove) {
      const highlight = this.highlights.get(id);
      if (highlight) {
        this.highlights.delete(id);
        removed.push(highlight);
      }
    }

    if (removed.length > 0) {
      this.notifyListeners({
        type: 'removed',
        highlights: removed
      });
    }

    return removed;
  }

  /**
   * EVENT HANDLING
   */

  /**
   * Add highlight change listener
   */
  onHighlightChange(listener: HighlightListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(event: HighlightChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in highlight change listener:', error);
      }
    }
  }

  /**
   * STATISTICS
   */

  /**
   * Get highlight statistics
   */
  getStats(): {
    totalHighlights: number;
    highlightsByColor: Record<string, number>;
    highlightsWithNotes: number;
    totalHighlightedCharacters: number;
  } {
    const highlights = Array.from(this.highlights.values());
    const colorCounts: Record<string, number> = {};
    let totalChars = 0;
    let notesCount = 0;

    for (const highlight of highlights) {
      colorCounts[highlight.color] = (colorCounts[highlight.color] || 0) + 1;
      totalChars += highlight.end - highlight.start;
      if (highlight.note && highlight.note.trim().length > 0) {
        notesCount++;
      }
    }

    return {
      totalHighlights: highlights.length,
      highlightsByColor: colorCounts,
      highlightsWithNotes: notesCount,
      totalHighlightedCharacters: totalChars
    };
  }
}