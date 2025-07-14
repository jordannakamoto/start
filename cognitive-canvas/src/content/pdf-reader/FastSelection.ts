// Fast Selection System - Speed optimized for real-time selection
// Minimal types and direct coordinate mapping

export interface FastTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  charStart: number; // Global character index start
  charEnd: number;   // Global character index end (exclusive)
}

export interface FastSelection {
  start: number; // Global character index
  end: number;   // Global character index
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extremely fast text model - optimized for coordinate lookups
 */
export class FastTextModel {
  private items: FastTextItem[] = [];
  private documentText: string = '';
  private charToItemMap: FastTextItem[] = []; // Direct array lookup by char index
  
  /**
   * Build from visual items - optimized for speed
   */
  build(visualItems: { str: string; x: number; y: number; width: number; height: number; }[]): void {
    // Sort by reading order (y first, then x)
    const sorted = visualItems.slice().sort((a, b) => {
      const yDiff = a.y - b.y;
      return Math.abs(yDiff) > 3 ? yDiff : a.x - b.x;
    });

    this.items = [];
    this.charToItemMap = [];
    let text = '';
    let charIndex = 0;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const charStart = charIndex;
      const charEnd = charIndex + item.str.length;
      
      const fastItem: FastTextItem = {
        str: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        charStart,
        charEnd
      };
      
      this.items.push(fastItem);
      
      // Fill direct lookup array
      for (let c = charStart; c < charEnd; c++) {
        this.charToItemMap[c] = fastItem;
      }
      
      text += item.str;
      charIndex = charEnd;
      
      // Add space between items if there's a gap
      const nextItem = sorted[i + 1];
      if (nextItem && this.needsSpace(item, nextItem)) {
        text += ' ';
        this.charToItemMap[charIndex] = fastItem; // Space belongs to current item
        charIndex++;
      }
    }
    
    this.documentText = text;
  }

  /**
   * Convert screen coordinates to character index - FAST
   */
  coordsToChar(x: number, y: number): number {
    let closestItem: FastTextItem | null = null;
    let minDist = Infinity;
    
    // Find closest item by distance
    for (const item of this.items) {
      const centerX = item.x + item.width / 2;
      const centerY = item.y;
      const dist = Math.abs(x - centerX) + Math.abs(y - centerY) * 2; // Weight Y more
      
      if (dist < minDist) {
        minDist = dist;
        closestItem = item;
      }
    }
    
    if (!closestItem) return 0;
    
    // Find character within item
    const relativeX = x - closestItem.x;
    const charWidth = closestItem.width / closestItem.str.length;
    const charOffset = Math.max(0, Math.min(
      Math.round(relativeX / charWidth),
      closestItem.str.length
    ));
    
    return closestItem.charStart + charOffset;
  }

  /**
   * Get selection rectangles - FAST
   */
  getSelectionRects(selection: FastSelection): SelectionRect[] {
    if (selection.start >= selection.end) return [];
    
    const rects: SelectionRect[] = [];
    const start = Math.max(0, selection.start);
    const end = Math.min(this.charToItemMap.length, selection.end);
    
    let currentRect: SelectionRect | null = null;
    let lastItem: FastTextItem | null = null;
    
    for (let i = start; i < end; i++) {
      const item = this.charToItemMap[i];
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

  /**
   * Get selected text - FAST
   */
  getText(selection: FastSelection): string {
    const start = Math.max(0, selection.start);
    const end = Math.min(this.documentText.length, selection.end);
    return this.documentText.slice(start, end);
  }

  /**
   * Get full document text
   */
  getDocumentText(): string {
    return this.documentText;
  }

  private needsSpace(current: any, next: any): boolean {
    // Simple heuristic: add space if significant gap or different line
    const lineChange = Math.abs(current.y - next.y) > 3;
    const gap = next.x - (current.x + current.width);
    const significantGap = gap > current.height * 0.3;
    
    return lineChange || significantGap;
  }
}

/**
 * Ultra-fast selection API - minimal overhead
 */
export class FastSelectionAPI {
  private textModel = new FastTextModel();
  private currentSelection: FastSelection | null = null;
  private listeners: ((selection: FastSelection | null) => void)[] = [];

  /**
   * Initialize with visual items
   */
  init(items: { str: string; x: number; y: number; width: number; height: number; }[]): void {
    this.textModel.build(items);
    this.currentSelection = null;
  }

  /**
   * Convert coordinates to character index
   */
  coordsToChar(x: number, y: number): number {
    return this.textModel.coordsToChar(x, y);
  }

  /**
   * Set selection by character range
   */
  setSelection(start: number, end: number): void {
    const selection: FastSelection = {
      start: Math.min(start, end),
      end: Math.max(start, end)
    };
    
    this.currentSelection = selection;
    this.notifyListeners();
  }

  /**
   * Get current selection
   */
  getSelection(): FastSelection | null {
    return this.currentSelection;
  }

  /**
   * Get selection rectangles for rendering
   */
  getSelectionRects(): SelectionRect[] {
    if (!this.currentSelection) return [];
    return this.textModel.getSelectionRects(this.currentSelection);
  }

  /**
   * Get selected text
   */
  getSelectedText(): string {
    if (!this.currentSelection) return '';
    return this.textModel.getText(this.currentSelection);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.currentSelection = null;
    this.notifyListeners();
  }

  /**
   * Add change listener
   */
  onChange(listener: (selection: FastSelection | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentSelection);
    }
  }
}