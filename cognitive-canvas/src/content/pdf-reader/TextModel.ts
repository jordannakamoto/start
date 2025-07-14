// TextModel.ts - Pure data store for lookups and markers by other systems
// NO UI logic, NO selection logic - only data storage and retrieval

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  pageIndex: number;
  charStart: number;
  charEnd: number;
  itemId: number;
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
  items: TextItem[];
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
 * TextModel - Pure data store for text content, coordinates, and structure
 * Used by other systems for lookups and data retrieval
 * NO selection logic - that belongs in SelectionAPI
 * NO UI logic - that belongs in FastSelection
 */
export class TextModel {
  private items: TextItem[] = [];
  private pages: TextPage[] = [];
  private documentText: string = '';
  private charToItemMap: TextItem[] = [];
  private globalOffsetToPosition: Map<number, TextPosition> = new Map();

  /**
   * Build text model from visual items
   */
  buildFromVisualItems(visualItems: { str: string; x: number; y: number; width: number; height: number; fontSize?: number; fontFamily?: string; pageIndex?: number; }[]): void {
    this.clear();
    
    // Sort by reading order
    const sorted = visualItems.slice().sort((a, b) => {
      const aPage = a.pageIndex || 0;
      const bPage = b.pageIndex || 0;
      if (aPage !== bPage) return aPage - bPage;
      
      const yDiff = a.y - b.y;
      return Math.abs(yDiff) > 3 ? yDiff : a.x - b.x;
    });

    this.items = [];
    let documentText = '';
    let charIndex = 0;

    // Convert to internal format
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
        fontSize: item.fontSize || 12,
        fontFamily: item.fontFamily || 'serif',
        pageIndex: item.pageIndex || 0,
        charStart,
        charEnd,
        itemId: i
      };

      this.items.push(textItem);
      
      // Build character mapping
      for (let c = charStart; c < charEnd; c++) {
        this.charToItemMap[c] = textItem;
      }

      documentText += item.str;
      charIndex = charEnd;

      // Add space between items if needed
      const nextItem = sorted[i + 1];
      if (nextItem && this.shouldAddSpace(item, nextItem)) {
        documentText += ' ';
        this.charToItemMap[charIndex] = textItem; // Space belongs to current item
        charIndex++;
      }
    }

    this.documentText = documentText;
    this.buildPages();
  }

  /**
   * Get text item at character index
   */
  getItemAt(charIndex: number): TextItem | null {
    return this.charToItemMap[charIndex] || null;
  }

  /**
   * Get all text items
   */
  getItems(): TextItem[] {
    return [...this.items];
  }

  /**
   * Get document text
   */
  getDocumentText(): string {
    return this.documentText;
  }

  /**
   * Get text substring
   */
  getText(start: number, end: number): string {
    return this.documentText.slice(start, end);
  }

  /**
   * Get document length
   */
  getLength(): number {
    return this.documentText.length;
  }

  /**
   * Get all pages
   */
  getPages(): TextPage[] {
    return [...this.pages];
  }

  /**
   * Get page by index
   */
  getPage(pageIndex: number): TextPage | null {
    return this.pages.find(p => p.pageIndex === pageIndex) || null;
  }

  /**
   * Convert global offset to position
   */
  offsetToPosition(offset: number): TextPosition | null {
    return this.globalOffsetToPosition.get(offset) || null;
  }

  /**
   * Find closest item to coordinates
   */
  findItemNear(x: number, y: number): TextItem | null {
    let closestItem: TextItem | null = null;
    let minDist = Infinity;

    for (const item of this.items) {
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
   * Convert coordinates to character index
   */
  coordinatesToOffset(x: number, y: number): number | null {
    const item = this.findItemNear(x, y);
    if (!item) return null;

    const relativeX = x - item.x;
    const charWidth = item.width / item.str.length;
    const charOffset = Math.max(0, Math.min(
      Math.round(relativeX / charWidth),
      item.str.length
    ));

    return item.charStart + charOffset;
  }

  /**
   * Get items in coordinate range
   */
  getItemsInRegion(x1: number, y1: number, x2: number, y2: number): TextItem[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    return this.items.filter(item =>
      item.x + item.width >= minX && item.x <= maxX &&
      item.y >= minY && item.y - item.height <= maxY
    );
  }

  private clear(): void {
    this.items = [];
    this.pages = [];
    this.documentText = '';
    this.charToItemMap = [];
    this.globalOffsetToPosition.clear();
  }

  private shouldAddSpace(current: any, next: any): boolean {
    const lineChange = Math.abs(current.y - next.y) > 3;
    const gap = next.x - (current.x + current.width);
    const significantGap = gap > (current.height || 12) * 0.3;
    return lineChange || significantGap;
  }

  private buildPages(): void {
    // Group items by page
    const pageGroups = new Map<number, TextItem[]>();
    
    for (const item of this.items) {
      if (!pageGroups.has(item.pageIndex)) {
        pageGroups.set(item.pageIndex, []);
      }
      pageGroups.get(item.pageIndex)!.push(item);
    }

    // Build page structures
    this.pages = [];
    for (const [pageIndex, pageItems] of pageGroups) {
      const lines = this.groupItemsIntoLines(pageItems);
      const pageText = lines.map(line => line.text).join('\n');
      const startOffset = pageItems.length > 0 ? pageItems[0].charStart : 0;
      const endOffset = pageItems.length > 0 ? pageItems[pageItems.length - 1].charEnd : 0;

      const page: TextPage = {
        pageIndex,
        text: pageText,
        startOffset,
        endOffset,
        lines,
        bounds: this.calculatePageBounds(lines)
      };

      this.pages.push(page);
    }

    // Build position mapping
    this.buildPositionMapping();
  }

  private groupItemsIntoLines(items: TextItem[]): TextLine[] {
    const lines: TextLine[] = [];
    const tolerance = 5;

    // Sort items by Y then X
    const sortedItems = items.slice().sort((a, b) => {
      const yDiff = a.y - b.y;
      return Math.abs(yDiff) > tolerance ? yDiff : a.x - b.x;
    });

    const lineGroups: TextItem[][] = [];
    for (const item of sortedItems) {
      let addedToLine = false;
      
      for (const line of lineGroups) {
        if (line.length > 0 && Math.abs(item.y - line[0].y) <= tolerance) {
          line.push(item);
          addedToLine = true;
          break;
        }
      }
      
      if (!addedToLine) {
        lineGroups.push([item]);
      }
    }

    // Convert to TextLine objects
    for (const lineItems of lineGroups) {
      lineItems.sort((a, b) => a.x - b.x);
      
      const text = lineItems.map(item => item.str).join('');
      const startOffset = lineItems[0].charStart;
      const endOffset = lineItems[lineItems.length - 1].charEnd;
      const bounds = this.calculateLineBounds(lineItems);

      lines.push({
        text,
        startOffset,
        endOffset,
        pageIndex: lineItems[0].pageIndex,
        items: lineItems,
        bounds
      });
    }

    return lines.sort((a, b) => a.items[0].y - b.items[0].y);
  }

  private calculateLineBounds(items: TextItem[]): { x: number; y: number; width: number; height: number; } {
    if (items.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    const minX = Math.min(...items.map(item => item.x));
    const maxX = Math.max(...items.map(item => item.x + item.width));
    const avgY = items.reduce((sum, item) => sum + item.y, 0) / items.length;
    const avgHeight = items.reduce((sum, item) => sum + item.height, 0) / items.length;
    
    return {
      x: minX,
      y: avgY,
      width: maxX - minX,
      height: avgHeight
    };
  }

  private calculatePageBounds(lines: TextLine[]): { width: number; height: number; } {
    if (lines.length === 0) return { width: 0, height: 0 };
    
    const maxWidth = Math.max(...lines.map(line => line.bounds.width));
    const totalHeight = lines.reduce((sum, line) => sum + line.bounds.height, 0);
    
    return { width: maxWidth, height: totalHeight };
  }

  private buildPositionMapping(): void {
    this.globalOffsetToPosition.clear();
    
    for (const page of this.pages) {
      for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex++) {
        const line = page.lines[lineIndex];
        
        for (let charIndex = 0; charIndex < line.text.length; charIndex++) {
          const globalOffset = line.startOffset + charIndex;
          const position: TextPosition = {
            pageIndex: page.pageIndex,
            lineIndex,
            charIndex,
            globalOffset
          };
          this.globalOffsetToPosition.set(globalOffset, position);
        }
      }
    }
  }
}