// TextModel and SelectionAPI for PDF text selection
// Isolated classes for future iteration and external integration

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  pageIndex: number;
}

export interface Selection {
  startOffset: number;
  endOffset: number;
}

export interface TextPosition {
  pageIndex: number;
  lineIndex: number;
  charIndex: number;
  globalOffset: number;
}

export interface TextLine {
  text: string;
  startOffset: number;
  endOffset: number;
  pageIndex: number;
  visualItems: TextItem[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TextPage {
  pageIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
  lines: TextLine[];
  bounds: {
    width: number;
    height: number;
  };
}

/**
 * TextModel - Manages the underlying text representation of a document
 * Provides string-based operations and coordinate mapping
 */
export class TextModel {
  private pages: TextPage[] = [];
  private documentText: string = '';
  private globalOffsetToPosition: Map<number, TextPosition> = new Map();
  private visualItemsToOffset: Map<string, number> = new Map();

  constructor() {}

  /**
   * Build the text model from visual text items
   */
  buildFromVisualItems(visualItems: TextItem[]): void {
    this.clear();
    
    // Group items by page and line
    const pageGroups = this.groupByPages(visualItems);
    
    let globalOffset = 0;
    
    for (const [pageIndex, pageItems] of pageGroups) {
      const pageStartOffset = globalOffset;
      const lines = this.groupIntoLines(pageItems);
      const processedLines: TextLine[] = [];
      
      let pageText = '';
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const visualLine = lines[lineIndex];
        
        // Build clean text for this line
        const lineText = this.buildLineText(visualLine);
        const lineStartOffset = globalOffset;
        const lineEndOffset = globalOffset + lineText.length;
        
        // Calculate line bounds
        const bounds = this.calculateLineBounds(visualLine);
        
        const textLine: TextLine = {
          text: lineText,
          startOffset: lineStartOffset,
          endOffset: lineEndOffset,
          pageIndex,
          visualItems: visualLine,
          bounds
        };
        
        processedLines.push(textLine);
        
        // Map each character to its position
        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
          const position: TextPosition = {
            pageIndex,
            lineIndex,
            charIndex,
            globalOffset: lineStartOffset + charIndex
          };
          this.globalOffsetToPosition.set(lineStartOffset + charIndex, position);
        }
        
        pageText += lineText;
        globalOffset += lineText.length;
        
        // Add newline between lines (except last)
        if (lineIndex < lines.length - 1) {
          pageText += '\n';
          globalOffset += 1;
          
          // Map newline character
          const position: TextPosition = {
            pageIndex,
            lineIndex,
            charIndex: lineText.length,
            globalOffset: globalOffset - 1
          };
          this.globalOffsetToPosition.set(globalOffset - 1, position);
        }
      }
      
      const page: TextPage = {
        pageIndex,
        text: pageText,
        startOffset: pageStartOffset,
        endOffset: globalOffset,
        lines: processedLines,
        bounds: this.calculatePageBounds(processedLines)
      };
      
      this.pages.push(page);
      this.documentText += pageText;
      
      // Add page break between pages (except last)
      if (pageIndex < pageGroups.size - 1) {
        this.documentText += '\n\n';
        globalOffset += 2;
      }
    }
  }

  /**
   * Get the complete document text
   */
  getDocumentText(): string {
    return this.documentText;
  }

  /**
   * Get all pages
   */
  getPages(): TextPage[] {
    return [...this.pages];
  }

  /**
   * Get text for a selection
   */
  getSelectionText(selection: Selection): string {
    if (selection.startOffset >= selection.endOffset) return '';
    return this.documentText.slice(selection.startOffset, selection.endOffset);
  }

  /**
   * Convert global offset to position
   */
  offsetToPosition(offset: number): TextPosition | null {
    return this.globalOffsetToPosition.get(offset) || null;
  }

  /**
   * Convert visual coordinates to global offset
   */
  coordinatesToOffset(x: number, y: number): number | null {
    for (const page of this.pages) {
      for (const line of page.lines) {
        // Check if point is within line bounds
        if (y >= line.bounds.y - line.bounds.height * 0.5 && 
            y <= line.bounds.y + line.bounds.height * 0.5) {
          
          // Find character at X position
          
          for (let i = 0; i < line.visualItems.length; i++) {
            const item = line.visualItems[i];
            
            if (x >= item.x && x <= item.x + item.width) {
              // Within this character - check which side
              const charCenter = item.x + item.width / 2;
              const charIndex = x < charCenter ? i : i + 1;
              return line.startOffset + Math.min(charIndex, line.text.length);
            }
          }
          
          // Past end of line
          if (x > line.bounds.x + line.bounds.width) {
            return line.endOffset;
          }
          
          // Before start of line
          if (x < line.bounds.x) {
            return line.startOffset;
          }
        }
      }
    }
    
    return null;
  }

  private clear(): void {
    this.pages = [];
    this.documentText = '';
    this.globalOffsetToPosition.clear();
    this.visualItemsToOffset.clear();
  }

  private groupByPages(items: TextItem[]): Map<number, TextItem[]> {
    const groups = new Map<number, TextItem[]>();
    
    for (const item of items) {
      if (!groups.has(item.pageIndex)) {
        groups.set(item.pageIndex, []);
      }
      groups.get(item.pageIndex)!.push(item);
    }
    
    // Sort pages by index
    return new Map([...groups.entries()].sort(([a], [b]) => a - b));
  }

  private groupIntoLines(items: TextItem[]): TextItem[][] {
    const lines: TextItem[][] = [];
    const tolerance = 5; // Y-position tolerance for same line
    
    // Sort items by Y position first, then X position
    const sortedItems = [...items].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > tolerance) return yDiff;
      return a.x - b.x;
    });
    
    for (const item of sortedItems) {
      let addedToLine = false;
      
      // Try to add to existing line
      for (const line of lines) {
        if (line.length > 0) {
          const lineY = line[0].y;
          if (Math.abs(item.y - lineY) <= tolerance) {
            line.push(item);
            addedToLine = true;
            break;
          }
        }
      }
      
      // Create new line if not added
      if (!addedToLine) {
        lines.push([item]);
      }
    }
    
    // Sort each line by X position
    lines.forEach(line => line.sort((a, b) => a.x - b.x));
    
    // Sort lines by Y position
    lines.sort((a, b) => a[0].y - b[0].y);
    
    return lines;
  }

  private buildLineText(visualItems: TextItem[]): string {
    let text = '';
    
    for (const item of visualItems) {
      text += item.str;
    }
    
    // Clean up text - normalize whitespace and add spaces between words
    text = text.replace(/\s+/g, ' '); // Normalize whitespace
    text = text.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space before capitals
    text = text.trim();
    
    return text;
  }

  private calculateLineBounds(visualItems: TextItem[]): { x: number; y: number; width: number; height: number } {
    if (visualItems.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    const minX = Math.min(...visualItems.map(item => item.x));
    const maxX = Math.max(...visualItems.map(item => item.x + item.width));
    const avgY = visualItems.reduce((sum, item) => sum + item.y, 0) / visualItems.length;
    const avgHeight = visualItems.reduce((sum, item) => sum + item.height, 0) / visualItems.length;
    
    return {
      x: minX,
      y: avgY,
      width: maxX - minX,
      height: avgHeight
    };
  }

  private calculatePageBounds(lines: TextLine[]): { width: number; height: number } {
    if (lines.length === 0) {
      return { width: 0, height: 0 };
    }
    
    const maxWidth = Math.max(...lines.map(line => line.bounds.width));
    const totalHeight = lines.reduce((sum, line) => sum + line.bounds.height, 0);
    
    return { width: maxWidth, height: totalHeight };
  }
}

/**
 * SelectionAPI - Provides smart selection operations and external integration
 */
export class SelectionAPI {
  private textModel: TextModel;
  private currentSelection: Selection | null = null;
  private selectionChangeListeners: ((selection: Selection | null) => void)[] = [];

  constructor(textModel: TextModel) {
    this.textModel = textModel;
  }

  /**
   * Select word at global offset
   */
  selectWordAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;
    
    let start = offset;
    let end = offset;
    
    // Expand backward to start of word
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    
    // Expand forward to end of word
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }
    
    // Ensure we have a valid word
    if (start === end || !/\w/.test(text.slice(start, end))) {
      return null;
    }
    
    const selection: Selection = { startOffset: start, endOffset: end };
    this.setSelection(selection);
    return selection;
  }

  /**
   * Select sentence at global offset
   */
  selectSentenceAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;
    
    let start = offset;
    let end = offset;
    
    // Find sentence start - look backward for sentence endings or start of text
    while (start > 0) {
      const char = text[start - 1];
      if (/[.!?]/.test(char)) {
        // Skip whitespace after punctuation
        while (start < text.length && /\s/.test(text[start])) {
          start++;
        }
        break;
      }
      start--;
    }
    
    // Find sentence end - look forward for sentence endings or end of text
    while (end < text.length) {
      const char = text[end];
      if (/[.!?]/.test(char)) {
        end++;
        break;
      }
      end++;
    }
    
    const selection: Selection = { startOffset: start, endOffset: end };
    this.setSelection(selection);
    return selection;
  }

  /**
   * Select paragraph at global offset
   */
  selectParagraphAt(offset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    if (offset >= text.length) return null;
    
    let start = offset;
    let end = offset;
    
    // Find paragraph start - look for double newlines or start of text
    while (start > 0) {
      if (text[start - 1] === '\n' && (start === 1 || text[start - 2] === '\n')) {
        break;
      }
      start--;
    }
    
    // Find paragraph end - look for double newlines or end of text
    while (end < text.length) {
      if (text[end] === '\n' && (end === text.length - 1 || text[end + 1] === '\n')) {
        break;
      }
      end++;
    }
    
    const selection: Selection = { startOffset: start, endOffset: end };
    this.setSelection(selection);
    return selection;
  }

  /**
   * Select line at global offset
   */
  selectLineAt(offset: number): Selection | null {
    const position = this.textModel.offsetToPosition(offset);
    if (!position) return null;
    
    const pages = this.textModel.getPages();
    const page = pages[position.pageIndex];
    if (!page || position.lineIndex >= page.lines.length) return null;
    
    const line = page.lines[position.lineIndex];
    const selection: Selection = { 
      startOffset: line.startOffset, 
      endOffset: line.endOffset 
    };
    
    this.setSelection(selection);
    return selection;
  }

  /**
   * Select all text
   */
  selectAll(): Selection | null {
    const text = this.textModel.getDocumentText();
    if (text.length === 0) return null;
    
    const selection: Selection = { startOffset: 0, endOffset: text.length };
    this.setSelection(selection);
    return selection;
  }

  /**
   * Select text between two global offsets
   */
  selectRange(startOffset: number, endOffset: number): Selection | null {
    const text = this.textModel.getDocumentText();
    const start = Math.max(0, Math.min(startOffset, endOffset));
    const end = Math.min(text.length, Math.max(startOffset, endOffset));
    
    if (start >= end) return null;
    
    const selection: Selection = { startOffset: start, endOffset: end };
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
   * Clear selection
   */
  clearSelection(): void {
    this.setSelection(null);
  }

  /**
   * Set selection (internal method with change notification)
   */
  private setSelection(selection: Selection | null): void {
    this.currentSelection = selection;
    this.notifySelectionChange(selection);
  }

  /**
   * Add selection change listener
   */
  onSelectionChange(listener: (selection: Selection | null) => void): () => void {
    this.selectionChangeListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.selectionChangeListeners.indexOf(listener);
      if (index > -1) {
        this.selectionChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of selection change
   */
  private notifySelectionChange(selection: Selection | null): void {
    for (const listener of this.selectionChangeListeners) {
      try {
        listener(selection);
      } catch (error) {
        console.error('Error in selection change listener:', error);
      }
    }
  }

  /**
   * Export selection data for external systems
   */
  exportSelection(): {
    selection: Selection | null;
    text: string;
    metadata: {
      wordCount: number;
      charCount: number;
      lineCount: number;
    };
  } | null {
    if (!this.currentSelection) return null;
    
    const text = this.getSelectedText();
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const lines = text.split('\n');
    
    return {
      selection: this.currentSelection,
      text,
      metadata: {
        wordCount: words.length,
        charCount: text.length,
        lineCount: lines.length
      }
    };
  }

  /**
   * Import selection from external systems
   */
  importSelection(data: { startOffset: number; endOffset: number }): Selection | null {
    return this.selectRange(data.startOffset, data.endOffset);
  }
}