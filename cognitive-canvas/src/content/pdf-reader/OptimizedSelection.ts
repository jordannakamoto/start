// Optimized Selection System - Designed for multi-selection and future operations
// Spatial indexing, selection collections, and advanced operations

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  charStart: number;
  charEnd: number;
  itemId: number; // Unique identifier for each text item
}

export interface Selection {
  id: string;
  start: number;
  end: number;
  type?: 'user' | 'search' | 'highlight' | 'annotation';
  metadata?: any;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  selectionId: string;
}

export interface SpatialBucket {
  items: TextItem[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; };
}

/**
 * Spatial Grid for O(1) coordinate lookups
 * Divides document into grid cells for fast spatial queries
 */
class SpatialIndex {
  private grid: Map<string, SpatialBucket> = new Map();
  private cellSize: number;
  private bounds: { minX: number; maxX: number; minY: number; maxY: number; };

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
    this.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  }

  /**
   * Build spatial index from text items - O(n) build time
   */
  build(items: TextItem[]): void {
    this.grid.clear();
    
    // Calculate document bounds
    for (const item of items) {
      this.bounds.minX = Math.min(this.bounds.minX, item.x);
      this.bounds.maxX = Math.max(this.bounds.maxX, item.x + item.width);
      this.bounds.minY = Math.min(this.bounds.minY, item.y - item.height);
      this.bounds.maxY = Math.max(this.bounds.maxY, item.y);
    }

    // Distribute items into grid cells
    for (const item of items) {
      const cells = this.getItemCells(item);
      for (const cellKey of cells) {
        if (!this.grid.has(cellKey)) {
          this.grid.set(cellKey, {
            items: [],
            bounds: this.getCellBounds(cellKey)
          });
        }
        this.grid.get(cellKey)!.items.push(item);
      }
    }
  }

  /**
   * Find closest item to coordinates - O(1) average case
   */
  findItemAt(x: number, y: number): TextItem | null {
    const cellKey = this.getCellKey(x, y);
    const bucket = this.grid.get(cellKey);
    
    if (!bucket || bucket.items.length === 0) {
      // Check adjacent cells if current cell is empty
      return this.findInAdjacentCells(x, y);
    }

    let closestItem: TextItem | null = null;
    let minDist = Infinity;

    for (const item of bucket.items) {
      const centerX = item.x + item.width / 2;
      const centerY = item.y;
      const dist = Math.abs(x - centerX) + Math.abs(y - centerY) * 2;
      
      if (dist < minDist) {
        minDist = dist;
        closestItem = item;
      }
    }

    return closestItem;
  }

  /**
   * Get all items in a rectangular region - O(k) where k is items in region
   */
  getItemsInRegion(x1: number, y1: number, x2: number, y2: number): TextItem[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const items = new Set<TextItem>();
    const cellKeys = this.getCellsInRegion(minX, minY, maxX, maxY);

    for (const cellKey of cellKeys) {
      const bucket = this.grid.get(cellKey);
      if (bucket) {
        for (const item of bucket.items) {
          // Check if item actually overlaps with region
          if (item.x + item.width >= minX && item.x <= maxX &&
              item.y >= minY && item.y - item.height <= maxY) {
            items.add(item);
          }
        }
      }
    }

    return Array.from(items);
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getItemCells(item: TextItem): string[] {
    const startCellX = Math.floor(item.x / this.cellSize);
    const endCellX = Math.floor((item.x + item.width) / this.cellSize);
    const startCellY = Math.floor((item.y - item.height) / this.cellSize);
    const endCellY = Math.floor(item.y / this.cellSize);

    const cells: string[] = [];
    for (let x = startCellX; x <= endCellX; x++) {
      for (let y = startCellY; y <= endCellY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    return cells;
  }

  private getCellsInRegion(minX: number, minY: number, maxX: number, maxY: number): string[] {
    const startCellX = Math.floor(minX / this.cellSize);
    const endCellX = Math.floor(maxX / this.cellSize);
    const startCellY = Math.floor(minY / this.cellSize);
    const endCellY = Math.floor(maxY / this.cellSize);

    const cells: string[] = [];
    for (let x = startCellX; x <= endCellX; x++) {
      for (let y = startCellY; y <= endCellY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    return cells;
  }

  private getCellBounds(cellKey: string): { minX: number; maxX: number; minY: number; maxY: number; } {
    const [x, y] = cellKey.split(',').map(Number);
    return {
      minX: x * this.cellSize,
      maxX: (x + 1) * this.cellSize,
      minY: y * this.cellSize,
      maxY: (y + 1) * this.cellSize
    };
  }

  private findInAdjacentCells(x: number, y: number): TextItem | null {
    const centerCell = this.getCellKey(x, y);
    const [cx, cy] = centerCell.split(',').map(Number);
    
    let closestItem: TextItem | null = null;
    let minDist = Infinity;

    // Check 3x3 grid around target cell
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const adjCellKey = `${cx + dx},${cy + dy}`;
        const bucket = this.grid.get(adjCellKey);
        
        if (bucket) {
          for (const item of bucket.items) {
            const centerX = item.x + item.width / 2;
            const centerY = item.y;
            const dist = Math.abs(x - centerX) + Math.abs(y - centerY) * 2;
            
            if (dist < minDist) {
              minDist = dist;
              closestItem = item;
            }
          }
        }
      }
    }

    return closestItem;
  }
}

/**
 * Character Index Manager - Optimized for range operations
 */
class CharacterIndex {
  private charToItem: TextItem[] = [];
  private documentText: string = '';
  private charRanges: Map<number, { item: TextItem; localIndex: number; }> = new Map();

  build(items: TextItem[], documentText: string): void {
    this.charToItem = [];
    this.documentText = documentText;
    this.charRanges.clear();

    // Build direct character mapping with range optimization
    for (const item of items) {
      for (let i = item.charStart; i < item.charEnd; i++) {
        this.charToItem[i] = item;
        this.charRanges.set(i, {
          item,
          localIndex: i - item.charStart
        });
      }
    }
  }

  getItemAt(charIndex: number): TextItem | null {
    return this.charToItem[charIndex] || null;
  }

  getCharacterInfo(charIndex: number): { item: TextItem; localIndex: number; } | null {
    return this.charRanges.get(charIndex) || null;
  }

  getText(start: number, end: number): string {
    return this.documentText.slice(start, end);
  }

  getDocumentText(): string {
    return this.documentText;
  }

  getLength(): number {
    return this.documentText.length;
  }
}

/**
 * Selection Collection Manager - Handles multiple selections efficiently
 */
class SelectionManager {
  private selections: Map<string, Selection> = new Map();
  private listeners: ((selections: Map<string, Selection>) => void)[] = [];
  private nextId: number = 0;

  /**
   * Add a new selection
   */
  addSelection(start: number, end: number, type: Selection['type'] = 'user', metadata?: any): Selection {
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
   * Remove selection by ID
   */
  removeSelection(id: string): boolean {
    const removed = this.selections.delete(id);
    if (removed) this.notifyListeners();
    return removed;
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
   * Get all selections
   */
  getSelections(): Map<string, Selection> {
    return new Map(this.selections);
  }

  /**
   * Get selections by type
   */
  getSelectionsByType(type: Selection['type']): Selection[] {
    return Array.from(this.selections.values()).filter(sel => sel.type === type);
  }

  /**
   * Get primary (user) selection
   */
  getPrimarySelection(): Selection | null {
    const userSelections = this.getSelectionsByType('user');
    return userSelections.length > 0 ? userSelections[userSelections.length - 1] : null;
  }

  /**
   * Clear all selections or by type
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
   * Find overlapping selections
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
   * Add change listener
   */
  onChange(listener: (selections: Map<string, Selection>) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(new Map(this.selections));
    }
  }
}

/**
 * Optimized Selection System - Maximum efficiency for multi-selection operations
 */
export class OptimizedSelectionAPI {
  private spatialIndex = new SpatialIndex();
  private charIndex = new CharacterIndex();
  private selectionManager = new SelectionManager();
  private items: TextItem[] = [];

  /**
   * Initialize with text items - builds all indices
   */
  init(visualItems: { str: string; x: number; y: number; width: number; height: number; }[]): void {
    // Convert to internal format with spatial optimization
    const sorted = visualItems.slice().sort((a, b) => {
      const yDiff = a.y - b.y;
      return Math.abs(yDiff) > 3 ? yDiff : a.x - b.x;
    });

    this.items = [];
    let documentText = '';
    let charIndex = 0;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const charStart = charIndex;
      const charEnd = charIndex + item.str.length;

      const textItem: TextItem = {
        str: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        charStart,
        charEnd,
        itemId: i
      };

      this.items.push(textItem);
      documentText += item.str;
      charIndex = charEnd;

      // Add space between items if needed
      const nextItem = sorted[i + 1];
      if (nextItem && this.needsSpace(item, nextItem)) {
        documentText += ' ';
        charIndex++;
      }
    }

    // Build all indices
    this.spatialIndex.build(this.items);
    this.charIndex.build(this.items, documentText);
    this.selectionManager.clearSelections();
  }

  /**
   * Convert coordinates to character index - O(1) average case
   */
  coordsToChar(x: number, y: number): number {
    const item = this.spatialIndex.findItemAt(x, y);
    if (!item) return 0;

    // Calculate character position within item
    const relativeX = x - item.x;
    const charWidth = item.width / item.str.length;
    const charOffset = Math.max(0, Math.min(
      Math.round(relativeX / charWidth),
      item.str.length
    ));

    return item.charStart + charOffset;
  }

  /**
   * Create selection - returns selection ID
   */
  createSelection(start: number, end: number, type: Selection['type'] = 'user'): string {
    const selection = this.selectionManager.addSelection(start, end, type);
    return selection.id;
  }

  /**
   * Update existing selection
   */
  updateSelection(id: string, start: number, end: number): boolean {
    return this.selectionManager.updateSelection(id, start, end);
  }

  /**
   * Set primary user selection (convenience method)
   */
  setSelection(start: number, end: number): void {
    // Clear existing user selections and create new one
    this.selectionManager.clearSelections('user');
    this.selectionManager.addSelection(start, end, 'user');
  }

  /**
   * Get all selection rectangles for rendering - optimized for GPU
   */
  getSelectionRects(): SelectionRect[] {
    const allRects: SelectionRect[] = [];
    const selections = this.selectionManager.getSelections();

    for (const [id, selection] of selections) {
      const rects = this.generateSelectionRects(selection);
      allRects.push(...rects.map(rect => ({ ...rect, selectionId: id })));
    }

    return allRects;
  }

  /**
   * Get primary selection
   */
  getSelection(): Selection | null {
    return this.selectionManager.getPrimarySelection();
  }

  /**
   * Get all selections
   */
  getAllSelections(): Map<string, Selection> {
    return this.selectionManager.getSelections();
  }

  /**
   * Get selected text for primary selection
   */
  getSelectedText(): string {
    const primary = this.selectionManager.getPrimarySelection();
    if (!primary) return '';
    return this.charIndex.getText(primary.start, primary.end);
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectionManager.clearSelections('user');
  }

  /**
   * Add selection change listener
   */
  onChange(listener: (selections: Map<string, Selection>) => void): () => void {
    return this.selectionManager.onChange(listener);
  }

  /**
   * Advanced operations for future features
   */

  /**
   * Select text in rectangular region
   */
  selectInRegion(x1: number, y1: number, x2: number, y2: number): string {
    const items = this.spatialIndex.getItemsInRegion(x1, y1, x2, y2);
    if (items.length === 0) return '';

    const charRanges = items.map(item => ({ start: item.charStart, end: item.charEnd }))
      .sort((a, b) => a.start - b.start);
    
    // Merge adjacent ranges
    const merged = [];
    for (const range of charRanges) {
      if (merged.length === 0 || merged[merged.length - 1].end < range.start) {
        merged.push(range);
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, range.end);
      }
    }

    // Create selections for each merged range
    for (const range of merged) {
      this.selectionManager.addSelection(range.start, range.end, 'user');
    }

    return merged.map(range => this.charIndex.getText(range.start, range.end)).join(' ');
  }

  /**
   * Find and highlight text patterns
   */
  findText(pattern: string | RegExp, highlightType: Selection['type'] = 'search'): Selection[] {
    const text = this.charIndex.getDocumentText();
    const matches: Selection[] = [];

    if (typeof pattern === 'string') {
      let index = 0;
      while ((index = text.indexOf(pattern, index)) !== -1) {
        const selection = this.selectionManager.addSelection(index, index + pattern.length, highlightType);
        matches.push(selection);
        index += pattern.length;
      }
    } else {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const selection = this.selectionManager.addSelection(match.index, match.index + match[0].length, highlightType);
        matches.push(selection);
        if (!pattern.global) break;
      }
    }

    return matches;
  }

  private generateSelectionRects(selection: Selection): SelectionRect[] {
    const rects: SelectionRect[] = [];
    let currentRect: SelectionRect | null = null;
    let lastItem: TextItem | null = null;

    for (let i = selection.start; i < selection.end; i++) {
      const item = this.charIndex.getItemAt(i);
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

  private needsSpace(current: any, next: any): boolean {
    const lineChange = Math.abs(current.y - next.y) > 3;
    const gap = next.x - (current.x + current.width);
    const significantGap = gap > current.height * 0.3;
    return lineChange || significantGap;
  }
}