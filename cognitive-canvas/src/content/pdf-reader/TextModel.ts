// TextModel.ts - Pure data store for lookups and markers by other systems
// NO UI logic, NO selection logic - only data storage and retrieval

// Shared canvas context for text measurement
export const TrivialCanvas = (() => {
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    return {
        getContext: (): CanvasRenderingContext2D | null => {
            if (!ctx) {
                canvas = document.createElement('canvas');
                ctx = canvas.getContext('2d');
            }
            return ctx;
        }
    };
})();

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
  
  // Spatial partitioning grid for fast hit-testing
  private grid: Map<string, TextItem[]> = new Map();
  private readonly GRID_SIZE = 100; // Grid cell size in pixels

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
    this.buildGrid();
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
   * Find closest item to coordinates using spatial grid
   */
  findItemNear(x: number, y: number, anchorX?: number, anchorY?: number): TextItem | null {
    // Calculate grid cell for the given coordinates
    const gridX = Math.floor(x / this.GRID_SIZE);
    const gridY = Math.floor(y / this.GRID_SIZE);
    const key = `${gridX},${gridY}`;
    
    // Get items from the target cell
    const cellItems = this.grid.get(key);
    
    // If no items in the exact cell, check neighboring cells
    const itemsToCheck: TextItem[] = [];
    if (cellItems && cellItems.length > 0) {
      itemsToCheck.push(...cellItems);
    }
    
    // Always check neighboring cells to catch edge cases
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighborKey = `${gridX + dx},${gridY + dy}`;
        const neighborItems = this.grid.get(neighborKey);
        if (neighborItems) {
          itemsToCheck.push(...neighborItems);
        }
      }
    }
    
    // Remove duplicates
    const uniqueItems = [...new Set(itemsToCheck)];
    
    // If still no items found, use smart fallback for empty space selection
    if (uniqueItems.length === 0) {
      return this.findItemForEmptySpace(x, y, anchorX, anchorY);
    }
    
    // Find closest item using improved algorithm
    let closestItem: TextItem | null = null;
    let minDist = Infinity;
    
    // First, try to find items that the point is actually within
    for (const item of uniqueItems) {
      const itemTop = item.y - item.height;
      const itemBottom = item.y;
      const itemLeft = item.x;
      const itemRight = item.x + item.width;
      
      // Check if the point is within this item's bounds
      if (x >= itemLeft && x <= itemRight && y >= itemTop && y <= itemBottom) {
        return item;
      }
    }
    
    // If no item contains the point, find the closest one
    for (const item of uniqueItems) {
      // Use a more accurate distance calculation
      const itemCenterX = item.x + item.width / 2;
      const itemCenterY = item.y - item.height / 2;
      
      // Calculate distance with Y-axis weighting to prefer items on the same line
      const xDist = Math.abs(x - itemCenterX);
      const yDist = Math.abs(y - itemCenterY);
      const dist = xDist + yDist * 3; // Weight Y distance more heavily
      
      if (dist < minDist) {
        minDist = dist;
        closestItem = item;
      }
    }
    return closestItem;
  }

  /**
   * Find appropriate text item for empty space selection
   * Used when clicking in margins, between lines, or other empty areas
   */
  private findItemForEmptySpace(x: number, y: number, anchorX?: number, anchorY?: number): TextItem | null {
    if (this.items.length === 0) return null;
    
    // Different behavior based on whether we have an anchor (selection in progress)
    const hasAnchor = anchorX !== undefined && anchorY !== undefined;
    
    // Strategy 1: Find items on the closest line vertically
    const itemsByLine = this.groupItemsByLine();
    let closestLine: TextItem[] | null = null;
    let minYDistance = Infinity;
    
    // If we have an anchor, consider the anchor's line for better selection continuity
    if (hasAnchor) {
      // Find the line that contains the anchor
      for (const lineItems of itemsByLine) {
        const lineY = lineItems[0].y;
        const lineTop = lineY - lineItems[0].height;
        const lineBottom = lineY + lineItems[0].height * 0.3;
        
        // Check if anchor is in this line
        if (anchorY! >= lineTop && anchorY! <= lineBottom) {
          // If focus is close to anchor's line, prefer anchor's line for continuity
          const focusToAnchorLineDist = Math.abs(y - lineY);
          if (focusToAnchorLineDist < lineItems[0].height * 2) {
            closestLine = lineItems;
            break;
          }
        }
      }
    }
    
    // If no anchor-based line found, find closest line normally
    if (!closestLine) {
      for (const lineItems of itemsByLine) {
        const lineY = lineItems[0].y;
        const lineTop = lineY - lineItems[0].height;
        const lineBottom = lineY + lineItems[0].height * 0.3; // Slightly larger margin
        
        let yDistance: number;
        if (y >= lineTop && y <= lineBottom) {
          // Click is within the line's vertical bounds
          yDistance = 0;
        } else {
          // Click is outside the line - calculate distance to closest edge
          yDistance = Math.min(Math.abs(y - lineTop), Math.abs(y - lineBottom));
        }
        
        if (yDistance < minYDistance) {
          minYDistance = yDistance;
          closestLine = lineItems;
        }
      }
    }
    
    if (!closestLine) return null;
    
    // Strategy 2: Within the closest line, find the most appropriate item
    // Behavior depends on whether we have an anchor or not
    
    const lineStart = Math.min(...closestLine.map(item => item.x));
    const lineEnd = Math.max(...closestLine.map(item => item.x + item.width));
    
    if (x < lineStart) {
      // Clicking to the left of the line - use first item (start of line)
      return closestLine.reduce((first, item) => item.x < first.x ? item : first);
    } else if (x > lineEnd) {
      // Clicking to the right of the line - use last item (end of line)
      return closestLine.reduce((last, item) => item.x + item.width > last.x + last.width ? item : last);
    } else {
      // Clicking within the line - behavior depends on anchor context
      let closestItem = closestLine[0];
      let minDistance = Infinity;
      
      // If we have an anchor, consider anchor-relative positioning
      if (hasAnchor) {
        // Find which item contains or is closest to the anchor
        let anchorItem: TextItem | null = null;
        for (const item of closestLine) {
          if (anchorX! >= item.x && anchorX! <= item.x + item.width) {
            anchorItem = item;
            break;
          }
        }
        
        // If anchor is in this line, use that context for better selection
        if (anchorItem) {
          // If focus is close to anchor, prefer items in the selection direction
          const isSelectingForward = x > anchorX!;
          const anchorToFocusDist = Math.abs(x - anchorX!);
          
          // If we're selecting in a clear direction and not too far, be more directional
          if (anchorToFocusDist > 50) { // Threshold for directional selection
            const candidates = isSelectingForward 
              ? closestLine.filter(item => item.x >= anchorItem!.x)
              : closestLine.filter(item => item.x <= anchorItem!.x);
            
            if (candidates.length > 0) {
              closestLine = candidates;
            }
          }
        }
      }
      
      // Find closest item with gap detection
      for (const item of closestLine) {
        // Check if clicking in a gap between this item and the next
        const itemEnd = item.x + item.width;
        const nextItem = closestLine.find(next => next.x > item.x && next.x === Math.min(...closestLine.filter(i => i.x > item.x).map(i => i.x)));
        
        if (nextItem) {
          const gapStart = itemEnd;
          const gapEnd = nextItem.x;
          
          // If clicking in the gap, choose the item based on which side of the gap center
          if (x >= gapStart && x <= gapEnd) {
            const gapCenter = (gapStart + gapEnd) / 2;
            return x < gapCenter ? item : nextItem;
          }
        }
        
        // Otherwise, use distance to item center
        const itemCenter = item.x + item.width / 2;
        const distance = Math.abs(x - itemCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestItem = item;
        }
      }
      
      return closestItem;
    }
  }

  /**
   * Group text items by line for empty space selection
   */
  private groupItemsByLine(): TextItem[][] {
    const lines: TextItem[][] = [];
    const tolerance = 5; // Y tolerance for same line
    
    for (const item of this.items) {
      let addedToLine = false;
      
      for (const line of lines) {
        if (Math.abs(item.y - line[0].y) <= tolerance) {
          line.push(item);
          addedToLine = true;
          break;
        }
      }
      
      if (!addedToLine) {
        lines.push([item]);
      }
    }
    
    // Sort items within each line by x position
    lines.forEach(line => line.sort((a, b) => a.x - b.x));
    
    return lines;
  }

  /**
   * Convert coordinates to character index
   */
  coordinatesToOffset(x: number, y: number, anchorX?: number, anchorY?: number): number | null {
    const item = this.findItemNear(x, y, anchorX, anchorY);
    if (!item) return null;

    const relativeX = x - item.x;
    
    // Handle special cases for margin and space clicks
    const charOffset = this.findCharacterOffset(item, relativeX, x, y);
    return item.charStart + charOffset;
  }

  /**
   * Find character offset within a text item using proportional positioning
   * This ensures consistency with the pre-calculated text width
   */
  private findCharacterOffset(item: TextItem, relativeX: number, _absoluteX?: number, _absoluteY?: number): number {
    // Handle clicking outside the item's horizontal bounds
    if (relativeX <= 0) return 0;
    if (relativeX >= item.width) return item.str.length;

    const ctx = TrivialCanvas.getContext();
    if (!ctx) {
        console.warn('Canvas context unavailable, falling back to inaccurate proportional math.');
        const proportion = relativeX / item.width;
        return Math.round(proportion * item.str.length);
    }

    ctx.font = `${item.fontSize}px ${item.fontFamily}`;

    // Iterate through the string, measuring substrings to find character boundaries
    for (let i = 0; i < item.str.length; i++) {
        const subWidth = ctx.measureText(item.str.substring(0, i + 1)).width;
        const prevSubWidth = (i > 0) ? ctx.measureText(item.str.substring(0, i)).width : 0;
        
        // The character's visual space is between prevSubWidth and subWidth.
        // Check if the click falls within this space.
        if (relativeX >= prevSubWidth && relativeX <= subWidth) {
            // To decide which side of the boundary to snap to, find the midpoint of the character.
            const charCenter = prevSubWidth + (subWidth - prevSubWidth) / 2;
            return (relativeX < charCenter) ? i : i + 1;
        }
    }
    
    return item.str.length; // Default to the end if loop finishes
  }



  /**
   * Get items in coordinate range using spatial grid
   */
  getItemsInRegion(x1: number, y1: number, x2: number, y2: number): TextItem[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    // Calculate grid cell range
    const startGridX = Math.floor(minX / this.GRID_SIZE);
    const endGridX = Math.floor(maxX / this.GRID_SIZE);
    const startGridY = Math.floor(minY / this.GRID_SIZE);
    const endGridY = Math.floor(maxY / this.GRID_SIZE);
    
    // Collect items from all relevant grid cells
    const itemSet = new Set<TextItem>();
    
    for (let gridX = startGridX; gridX <= endGridX; gridX++) {
      for (let gridY = startGridY; gridY <= endGridY; gridY++) {
        const key = `${gridX},${gridY}`;
        const cellItems = this.grid.get(key);
        if (cellItems) {
          for (const item of cellItems) {
            // Precise bounds check
            if (item.x + item.width >= minX && item.x <= maxX &&
                item.y >= minY && item.y - item.height <= maxY) {
              itemSet.add(item);
            }
          }
        }
      }
    }
    
    return Array.from(itemSet);
  }

  private clear(): void {
    this.items = [];
    this.pages = [];
    this.documentText = '';
    this.charToItemMap = [];
    this.globalOffsetToPosition.clear();
    this.grid.clear();
  }

  /**
   * Build spatial partitioning grid for fast hit-testing
   */
  private buildGrid(): void {
    this.grid.clear();
    
    for (const item of this.items) {
      // Calculate the range of grid cells this item overlaps
      const startX = Math.floor(item.x / this.GRID_SIZE);
      const endX = Math.floor((item.x + item.width) / this.GRID_SIZE);
      const startY = Math.floor((item.y - item.height) / this.GRID_SIZE);
      const endY = Math.floor(item.y / this.GRID_SIZE);
      
      // Add item to all grid cells it overlaps
      for (let gridX = startX; gridX <= endX; gridX++) {
        for (let gridY = startY; gridY <= endY; gridY++) {
          const key = `${gridX},${gridY}`;
          if (!this.grid.has(key)) {
            this.grid.set(key, []);
          }
          this.grid.get(key)!.push(item);
        }
      }
    }
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