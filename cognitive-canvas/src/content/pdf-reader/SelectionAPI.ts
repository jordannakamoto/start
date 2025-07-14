// Modern Selection API for PDF Reader
// Provides clean abstraction between display layer and data layer

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  pageIndex: number;
  globalCharIndex: number; // NEW: direct mapping to global text position
}

export interface Selection {
  startOffset: number;
  endOffset: number;
  type: 'manual' | 'word' | 'sentence' | 'line' | 'clause' | 'section' | 'all';
}

export interface SelectionBounds {
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    pageIndex: number;
  }>;
}

export interface ViewportInfo {
  scrollTop: number;
  containerWidth: number;
  containerHeight: number;
  scale: number;
}

/**
 * Core text model - simplified and focused on essential operations
 */
export class TextModel {
  private documentText: string = '';
  private textItems: TextItem[] = []; // Flattened, globally indexed text items
  private globalCharToItem: Map<number, TextItem> = new Map();
  
  constructor() {}

  /**
   * Build model from visual items with global character indexing
   */
  buildFromVisualItems(visualItems: TextItem[]): void {
    this.clear();
    
    // Sort items by reading order (page, y, x)
    const sortedItems = [...visualItems].sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (Math.abs(a.y - b.y) > 5) return a.y - b.y; // Line tolerance
      return a.x - b.x;
    });

    // Build global text and character mappings
    let globalCharIndex = 0;
    let documentText = '';
    
    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const itemText = item.str;
      
      // Create enhanced text item with global character index
      const enhancedItem: TextItem = {
        ...item,
        globalCharIndex
      };
      
      this.textItems.push(enhancedItem);
      
      // Map each character to its text item
      for (let charIdx = 0; charIdx < itemText.length; charIdx++) {
        this.globalCharToItem.set(globalCharIndex + charIdx, enhancedItem);
      }
      
      documentText += itemText;
      globalCharIndex += itemText.length;
      
      // Add space between items if needed (simple heuristic)
      const nextItem = sortedItems[i + 1];
      if (nextItem && this.shouldAddSpace(item, nextItem)) {
        documentText += ' ';
        globalCharIndex += 1;
      }
    }
    
    this.documentText = documentText;
  }

  /**
   * Convert screen coordinates to global character offset
   */
  coordinatesToOffset(x: number, y: number): number | null {
    // Find closest text item
    let closestItem: TextItem | null = null;
    let minDistance = Infinity;
    
    for (const item of this.textItems) {
      const distance = Math.sqrt(
        Math.pow(x - (item.x + item.width / 2), 2) + 
        Math.pow(y - item.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestItem = item;
      }
    }
    
    if (!closestItem) return null;
    
    // Calculate character position within the item
    const relativeX = x - closestItem.x;
    const charWidth = closestItem.width / closestItem.str.length;
    const charIndex = Math.max(0, Math.min(
      Math.round(relativeX / charWidth),
      closestItem.str.length
    ));
    
    return closestItem.globalCharIndex + charIndex;
  }

  /**
   * Get text for selection
   */
  getSelectionText(selection: Selection): string {
    const start = Math.max(0, selection.startOffset);
    const end = Math.min(this.documentText.length, selection.endOffset);
    return this.documentText.slice(start, end);
  }

  /**
   * Get visual bounds for selection
   */
  getSelectionBounds(selection: Selection): SelectionBounds {
    const rects: SelectionBounds['rects'] = [];
    const start = Math.max(0, selection.startOffset);
    const end = Math.min(this.documentText.length, selection.endOffset);
    
    if (start >= end) return { rects };
    
    // Group characters into visual rectangles
    let currentRect: SelectionBounds['rects'][0] | null = null;
    
    for (let charIndex = start; charIndex < end; charIndex++) {
      const item = this.globalCharToItem.get(charIndex);
      if (!item) continue;
      
      const charPositionInItem = charIndex - item.globalCharIndex;
      const charWidth = item.width / item.str.length;
      const charX = item.x + (charPositionInItem * charWidth);
      
      // Check if we can extend current rectangle
      if (currentRect && 
          currentRect.pageIndex === item.pageIndex &&
          Math.abs(currentRect.y - (item.y - item.fontSize * 0.8)) < 2 &&
          Math.abs(currentRect.x + currentRect.width - charX) < 2) {
        // Extend current rectangle
        currentRect.width = charX + charWidth - currentRect.x;
      } else {
        // Start new rectangle
        if (currentRect) rects.push(currentRect);
        currentRect = {
          x: charX,
          y: item.y - item.fontSize * 0.8,
          width: charWidth,
          height: item.fontSize * 1.2,
          pageIndex: item.pageIndex
        };
      }
    }
    
    if (currentRect) rects.push(currentRect);
    return { rects };
  }

  /**
   * Get complete document text
   */
  getDocumentText(): string {
    return this.documentText;
  }

  private clear(): void {
    this.documentText = '';
    this.textItems = [];
    this.globalCharToItem.clear();
  }

  private shouldAddSpace(current: TextItem, next: TextItem): boolean {
    // Add space if there's a significant gap or different page
    if (current.pageIndex !== next.pageIndex) return true;
    if (Math.abs(current.y - next.y) > 5) return true; // Different line
    
    const gap = next.x - (current.x + current.width);
    return gap > current.fontSize * 0.3; // Significant horizontal gap
  }
}

/**
 * Smart selection algorithms with simple delimiters
 */
export class SmartSelector {
  constructor(private textModel: TextModel) {}

  selectWordAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Expand to word boundaries (spaces/punctuation)
    while (start > 0 && !/[\s\n\t.,;!?]/.test(text[start - 1])) start--;
    while (end < text.length && !/[\s\n\t.,;!?]/.test(text[end])) end++;

    if (start === end) return null;
    return { startOffset: start, endOffset: end, type: 'word' };
  }

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

    return { startOffset: start, endOffset: end, type: 'sentence' };
  }

  selectLineAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Find line boundaries
    while (start > 0 && text[start - 1] !== '\n') start--;
    while (end < text.length && text[end] !== '\n') end++;

    return { startOffset: start, endOffset: end, type: 'line' };
  }

  selectClauseAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Find clause patterns (numbered/lettered items)
    const clausePattern = /^\s*(?:\d+\.|[a-z]\)|[A-Z]\.)/;
    
    // Go to start of current line
    while (start > 0 && text[start - 1] !== '\n') start--;
    
    // Find next clause or end
    while (end < text.length) {
      if (text[end] === '\n' && end + 1 < text.length) {
        const lineStart = end + 1;
        const lineEnd = text.indexOf('\n', lineStart);
        const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
        if (clausePattern.test(line)) break;
      }
      end++;
    }

    return { startOffset: start, endOffset: end, type: 'clause' };
  }

  selectSectionAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    // Find section headers
    const sectionPattern = /^\s*(?:SECTION|Section|ARTICLE|Article)\s+[IVX\d]+/i;
    
    // Find current or previous section start
    while (start > 0) {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = text.indexOf('\n', lineStart);
      const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
      
      if (sectionPattern.test(line)) {
        start = lineStart;
        break;
      }
      start = lineStart - 1;
    }

    // Find next section or end
    while (end < text.length) {
      const lineStart = text.indexOf('\n', end) + 1;
      if (lineStart === 0) break;
      
      const lineEnd = text.indexOf('\n', lineStart);
      const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
      
      if (sectionPattern.test(line)) {
        end = lineStart - 1;
        break;
      }
      end = lineEnd === -1 ? text.length : lineEnd;
    }

    return { startOffset: start, endOffset: end, type: 'section' };
  }

  selectAll(): Selection {
    const text = this.textModel.getDocumentText();
    return { startOffset: 0, endOffset: text.length, type: 'all' };
  }
}

/**
 * Main Selection API - coordinates between display and data layers
 */
export class SelectionAPI {
  private textModel: TextModel;
  private smartSelector: SmartSelector;
  private currentSelection: Selection | null = null;
  private listeners: ((selection: Selection | null) => void)[] = [];

  constructor() {
    this.textModel = new TextModel();
    this.smartSelector = new SmartSelector(this.textModel);
  }

  /**
   * Initialize with visual text items
   */
  initialize(visualItems: TextItem[]): void {
    this.textModel.buildFromVisualItems(visualItems);
    this.currentSelection = null;
    this.notifyListeners();
  }

  /**
   * Convert screen coordinates to selection offset
   */
  coordinatesToOffset(x: number, y: number): number | null {
    return this.textModel.coordinatesToOffset(x, y);
  }

  /**
   * Create manual selection range
   */
  selectRange(startOffset: number, endOffset: number): Selection {
    const selection: Selection = {
      startOffset: Math.min(startOffset, endOffset),
      endOffset: Math.max(startOffset, endOffset),
      type: 'manual'
    };
    this.setSelection(selection);
    return selection;
  }

  /**
   * Smart selection methods
   */
  selectWordAt(offset: number): Selection | null {
    const selection = this.smartSelector.selectWordAt(offset);
    this.setSelection(selection);
    return selection;
  }

  selectSentenceAt(offset: number): Selection | null {
    const selection = this.smartSelector.selectSentenceAt(offset);
    this.setSelection(selection);
    return selection;
  }

  selectLineAt(offset: number): Selection | null {
    const selection = this.smartSelector.selectLineAt(offset);
    this.setSelection(selection);
    return selection;
  }

  selectClauseAt(offset: number): Selection | null {
    const selection = this.smartSelector.selectClauseAt(offset);
    this.setSelection(selection);
    return selection;
  }

  selectSectionAt(offset: number): Selection | null {
    const selection = this.smartSelector.selectSectionAt(offset);
    this.setSelection(selection);
    return selection;
  }

  selectAll(): Selection {
    const selection = this.smartSelector.selectAll();
    this.setSelection(selection);
    return selection;
  }

  /**
   * Get current selection
   */
  getSelection(): Selection | null {
    return this.currentSelection;
  }

  /**
   * Get selected text
   */
  getSelectedText(): string {
    if (!this.currentSelection) return '';
    return this.textModel.getSelectionText(this.currentSelection);
  }

  /**
   * Get visual bounds for rendering
   */
  getSelectionBounds(): SelectionBounds | null {
    if (!this.currentSelection) return null;
    return this.textModel.getSelectionBounds(this.currentSelection);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.setSelection(null);
  }

  /**
   * Add selection change listener
   */
  onSelectionChange(listener: (selection: Selection | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private setSelection(selection: Selection | null): void {
    this.currentSelection = selection;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSelection);
      } catch (error) {
        console.error('Error in selection change listener:', error);
      }
    }
  }
}