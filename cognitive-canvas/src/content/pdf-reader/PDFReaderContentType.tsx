// PDF Reader content type - Custom headless PDF.js implementation
// Direct canvas rendering with custom text layer for perfect alignment

import * as pdfjsLib from 'pdfjs-dist';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContentEditorProps, ContentTypeDefinition } from '../types';
import { TextModel, SelectionAPI, Selection, TextItem } from './TextModel';

// Using TextItem, Selection, etc. from TextModel.ts

interface PageInfo {
  index: number;
  width: number;
  height: number;
  offsetY: number;
}

interface VisiblePage {
  pageIndex: number;
  page: pdfjsLib.PDFPageProxy;
  offsetY: number;
  viewport: pdfjsLib.PageViewport;
}

// Configure PDF.js worker. This is essential.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFContent {
  url?: string;
  base64?: string;
  title?: string;
}

// Virtualized PDF document viewer with natural scrolling and double buffering
const PDFDocumentViewer = memo(({ pages, scale }: { pages: pdfjsLib.PDFPageProxy[], scale: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const textModelRef = useRef<TextModel>(new TextModel());
  const selectionAPIRef = useRef<SelectionAPI>(new SelectionAPI(textModelRef.current));
  const textLinesRef = useRef<TextItem[][]>([]);
  const pagesInfoRef = useRef<PageInfo[]>([]);
  const visiblePagesRef = useRef<VisiblePage[]>([]);
  const prerenderedTextRef = useRef<Map<number, TextItem[]>>(new Map());
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{x: number, y: number} | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollUpdateRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const lastClickPositionRef = useRef<{x: number, y: number} | null>(null);
  
  const [selection, setSelection] = useState<Selection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [visiblePages, setVisiblePages] = useState<VisiblePage[]>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [maxWidth, setMaxWidth] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Calculate which pages should be visible based on scroll position
  const calculateVisiblePages = useCallback((scrollTop: number, containerHeight: number): VisiblePage[] => {
    if (pagesInfoRef.current.length === 0) return [];
    
    const buffer = containerHeight; // Load 1 screen height before/after visible area
    const viewportTop = scrollTop - buffer;
    const viewportBottom = scrollTop + containerHeight + buffer;
    
    const visible: VisiblePage[] = [];
    
    for (const pageInfo of pagesInfoRef.current) {
      const pageTop = pageInfo.offsetY;
      const pageBottom = pageInfo.offsetY + pageInfo.height;
      
      // Check if page is in viewport (with buffer)
      if (pageBottom >= viewportTop && pageTop <= viewportBottom) {
        const page = pages[pageInfo.index];
        const viewport = page.getViewport({ scale });
        
        visible.push({
          pageIndex: pageInfo.index,
          page,
          offsetY: pageInfo.offsetY,
          viewport
        });
      }
    }
    
    return visible;
  }, [pages, scale]);

  // Calculate current page based on scroll position
  const calculateCurrentPage = useCallback((scrollTop: number): number => {
    if (pagesInfoRef.current.length === 0) return 1;
    
    for (let i = 0; i < pagesInfoRef.current.length; i++) {
      const pageInfo = pagesInfoRef.current[i];
      if (scrollTop < pageInfo.offsetY + pageInfo.height / 2) {
        return i + 1;
      }
    }
    
    return pagesInfoRef.current.length;
  }, []);

  // Smart selection using SelectionAPI
  const selectWordAt = useCallback((globalOffset: number): Selection | null => {
    return selectionAPIRef.current.selectWordAt(globalOffset);
  }, []);

  const selectSentenceAt = useCallback((globalOffset: number): Selection | null => {
    return selectionAPIRef.current.selectSentenceAt(globalOffset);
  }, []);

  const selectParagraphAt = useCallback((globalOffset: number): Selection | null => {
    return selectionAPIRef.current.selectParagraphAt(globalOffset);
  }, []);

  const selectAll = useCallback((): Selection | null => {
    return selectionAPIRef.current.selectAll();
  }, []);

  const groupTextIntoLines = (items: TextItem[]): TextItem[][] => {
    const lines: TextItem[][] = [];
    const tolerance = 5; // pixels tolerance for same line
    
    items.forEach(item => {
      let addedToLine = false;
      
      for (let i = 0; i < lines.length; i++) {
        const lineY = lines[i][0].y;
        const linePageIndex = lines[i][0].pageIndex;
        // Items must be on same page and same Y position to be on same line
        if (item.pageIndex === linePageIndex && Math.abs(item.y - lineY) <= tolerance) {
          lines[i].push(item);
          addedToLine = true;
          break;
        }
      }
      
      if (!addedToLine) {
        lines.push([item]);
      }
    });
    
    // Sort lines by page index, then Y position, and items within lines by X position
    lines.sort((a, b) => {
      if (a[0].pageIndex !== b[0].pageIndex) {
        return a[0].pageIndex - b[0].pageIndex;
      }
      return a[0].y - b[0].y;
    });
    lines.forEach(line => line.sort((a, b) => a.x - b.x));
    
    return lines;
  };

  // Convert visual coordinates to global offset using TextModel
  const positionToOffset = useCallback((x: number, y: number): number | null => {
    return textModelRef.current.coordinatesToOffset(x, y);
  }, []);

  const drawSelection = useCallback((ctx: CanvasRenderingContext2D, sel: Selection) => {
    if (!sel) return;
    
    const visualLines = textLinesRef.current;
    const pages = textModelRef.current.getPages();
    
    if (!visualLines.length || !pages.length) return;
    
    ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
    
    // Convert global offsets to positions
    const startPos = textModelRef.current.offsetToPosition(sel.startOffset);
    const endPos = textModelRef.current.offsetToPosition(sel.endOffset);
    
    if (!startPos || !endPos) return;
    
    // Find the visual lines that correspond to our selection
    for (let lineIndex = 0; lineIndex < visualLines.length; lineIndex++) {
      const visualLine = visualLines[lineIndex];
      if (visualLine.length === 0) continue;
      
      // Check if this visual line intersects with our selection
      const pageIndex = visualLine[0].pageIndex;
      const page = pages.find(p => p.pageIndex === pageIndex);
      if (!page) continue;
      
      const lineInPage = page.lines.find(line => 
        line.visualItems.some(item => 
          visualLine.some(vItem => 
            vItem.x === item.x && vItem.y === item.y && vItem.str === item.str
          )
        )
      );
      
      if (!lineInPage) continue;
      
      // Check if selection overlaps with this line
      if (sel.endOffset < lineInPage.startOffset || sel.startOffset > lineInPage.endOffset) {
        continue;
      }
      
      // Calculate selection bounds within this line
      const lineStartOffset = Math.max(sel.startOffset, lineInPage.startOffset);
      const lineEndOffset = Math.min(sel.endOffset, lineInPage.endOffset);
      
      // Map to visual character positions
      const startCharInLine = lineStartOffset - lineInPage.startOffset;
      const endCharInLine = lineEndOffset - lineInPage.startOffset;
      
      // Find visual coordinates
      let startX = visualLine[0].x;
      let endX = visualLine[visualLine.length - 1].x + visualLine[visualLine.length - 1].width;
      
      if (startCharInLine < visualLine.length && startCharInLine >= 0) {
        startX = visualLine[Math.min(startCharInLine, visualLine.length - 1)].x;
      }
      
      if (endCharInLine <= visualLine.length && endCharInLine >= 0) {
        const endIndex = Math.min(endCharInLine, visualLine.length - 1);
        endX = endCharInLine < visualLine.length ? 
          visualLine[endIndex].x + visualLine[endIndex].width :
          visualLine[endIndex].x + visualLine[endIndex].width;
      }
      
      // Draw selection rectangle
      const y = visualLine[0].y - visualLine[0].fontSize * 0.8;
      const height = visualLine[0].fontSize * 1.1;
      
      ctx.fillRect(startX, y, Math.max(endX - startX, 2), height);
    }
  }, []);

  const getSelectedText = useCallback((): string => {
    return selectionAPIRef.current.getSelectedText();
  }, []);


  const updateSelection = useCallback((x: number, y: number) => {
    if (!isSelectingRef.current || !selectionStartRef.current) return;
    
    const startOffset = positionToOffset(selectionStartRef.current.x, selectionStartRef.current.y);
    const endOffset = positionToOffset(x, y);
    
    if (startOffset !== null && endOffset !== null) {
      // Use SelectionAPI to create selection
      const newSelection = selectionAPIRef.current.selectRange(startOffset, endOffset);
      
      if (newSelection) {
        setSelection(newSelection);
        
        // Immediately update selection canvas
        if (selectionCanvasRef.current) {
          const ctx = selectionCanvasRef.current.getContext('2d');
          if (ctx) {
            drawSelection(ctx, newSelection);
          }
        }
      }
    }
  }, [positionToOffset, drawSelection]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!textCanvasRef.current) return;
    
    // Prevent default browser selection behavior
    e.preventDefault();
    e.stopPropagation();
    
    const rect = textCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTimeRef.current;
    const positionDiff = lastClickPositionRef.current ? 
      Math.abs(x - lastClickPositionRef.current.x) + Math.abs(y - lastClickPositionRef.current.y) : Infinity;
    
    // Reset click count if too much time passed or click is far from last click
    if (timeDiff > 500 || positionDiff > 10) {
      clickCountRef.current = 1;
    } else {
      clickCountRef.current++;
    }
    
    lastClickTimeRef.current = currentTime;
    lastClickPositionRef.current = { x, y };
    
    // Get global offset for smart selection
    const globalOffset = positionToOffset(x, y);
    
    if (globalOffset !== null && clickCountRef.current > 1) {
      // Smart selection with legal document support
      let newSelection: Selection | null = null;
      
      switch (clickCountRef.current) {
        case 2: // Double-click: Select word
          newSelection = selectWordAt(globalOffset);
          break;
        case 3: // Triple-click: Select sentence/clause
          newSelection = selectSentenceAt(globalOffset);
          break;
        case 4: // Quad-click: Select legal clause
          newSelection = selectionAPIRef.current.selectClauseAt(globalOffset);
          break;
        case 5: // 5-click: Select legal section
          newSelection = selectionAPIRef.current.selectSectionAt(globalOffset);
          break;
        case 6: // 6-click: Select paragraph
          newSelection = selectParagraphAt(globalOffset);
          break;
        default: // 7+ clicks: Select all text
          newSelection = selectAll();
          break;
      }
      
      if (newSelection) {
        setSelection(newSelection);
        isSelectingRef.current = false;
        selectionStartRef.current = null;
        return;
      }
    }
    
    // Normal click - start manual selection
    isSelectingRef.current = true;
    selectionStartRef.current = { x, y };
    selectionAPIRef.current.clearSelection();
    setSelection(null);
    
    // Clear selection canvas
    if (selectionCanvasRef.current) {
      const ctx = selectionCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    }
  }, [positionToOffset, selectWordAt, selectSentenceAt, selectParagraphAt, selectAll]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelectingRef.current || !textCanvasRef.current) return;
    
    // Prevent default browser behavior
    e.preventDefault();
    
    // Cancel previous animation frame for performance
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Throttle updates using requestAnimationFrame for 60fps
    animationFrameRef.current = requestAnimationFrame(() => {
      if (!textCanvasRef.current) return;
      
      const rect = textCanvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      updateSelection(x, y);
    });
  }, [updateSelection]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Prevent default browser behavior
    e.preventDefault();
    e.stopPropagation();
    
    isSelectingRef.current = false;
    selectionStartRef.current = null;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);


  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection) {
      const text = getSelectedText();
      navigator.clipboard.writeText(text);
    }
  }, [selection, getSelectedText]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Pre-render all text content to avoid async operations during scroll
  useEffect(() => {
    const preRenderAllText = async () => {
      if (pages.length === 0) return;

      console.log('Pre-rendering text for all pages...');
      const textMap = new Map<number, TextItem[]>();
      
      // Calculate document dimensions and page positions
      let docTotalHeight = 0;
      let docMaxWidth = 0;
      const pagesInfo: PageInfo[] = [];

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const viewport = page.getViewport({ scale });
        
        pagesInfo.push({
          index: pageIndex,
          width: viewport.width,
          height: viewport.height,
          offsetY: docTotalHeight
        });
        
        // Pre-extract text content for this page
        const textContent = await page.getTextContent();
        const pageTextItems: TextItem[] = [];
        
        textContent.items.forEach((item: any) => {
          if (item.str.trim()) {
            const [a, , , , e, f] = item.transform;
            const fontSize = Math.abs(a) * scale;
            const x = e * scale;
            const y = viewport.height - f * scale;
            
            pageTextItems.push({
              str: item.str,
              x,
              y,
              width: 0, // Will be calculated during render
              height: fontSize,
              fontSize,
              fontFamily: item.fontName || 'serif',
              pageIndex
            });
          }
        });
        
        textMap.set(pageIndex, pageTextItems);
        docTotalHeight += viewport.height;
        docMaxWidth = Math.max(docMaxWidth, viewport.width);
      }

      prerenderedTextRef.current = textMap;
      pagesInfoRef.current = pagesInfo;
      setTotalHeight(docTotalHeight);
      setMaxWidth(docMaxWidth);
      
      // Initial visible pages calculation
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const initialVisible = calculateVisiblePages(0, containerHeight);
        setVisiblePages(initialVisible);
        visiblePagesRef.current = initialVisible;
      }
      
      console.log('Text pre-rendering complete for', pages.length, 'pages');
    };

    preRenderAllText();
  }, [pages, scale, calculateVisiblePages]);


  // Track last visible pages for text model optimization
  const lastVisiblePagesRef = useRef<string>('');
  
  // Render text layer only (performance optimized)
  useEffect(() => {
    const renderTextLayer = () => {
      if (!textCanvasRef.current || visiblePages.length === 0 || !containerRef.current || 
          prerenderedTextRef.current.size === 0) return;

      const textCanvas = textCanvasRef.current;
      const textCtx = textCanvas.getContext('2d');
      if (!textCtx) return;

      // Get container dimensions
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Setup text canvas
      textCanvas.width = containerWidth * devicePixelRatio;
      textCanvas.height = containerHeight * devicePixelRatio;
      textCanvas.style.width = `${containerWidth}px`;
      textCanvas.style.height = `${containerHeight}px`;
      
      textCtx.scale(devicePixelRatio, devicePixelRatio);
      textCtx.textBaseline = 'alphabetic';

      // Clear text canvas with white background
      textCtx.fillStyle = 'white';
      textCtx.fillRect(0, 0, containerWidth, containerHeight);

      // Calculate horizontal centering offset
      const pageHorizontalOffset = (containerWidth - maxWidth) / 2;
      const scrollTop = containerRef.current?.scrollTop || 0;

      // Render visible pages using pre-rendered text
      const allVisibleTextItems: TextItem[] = [];

      for (const visiblePage of visiblePages) {
        const { pageIndex, viewport, offsetY } = visiblePage;
        const pageTextItems = prerenderedTextRef.current.get(pageIndex);
        
        if (!pageTextItems) continue;

        // Transform pre-rendered text to viewport coordinates
        for (const textItem of pageTextItems) {
          // Calculate absolute position in document
          const absoluteY = textItem.y + offsetY;
          
          // Convert to viewport-relative coordinates
          const relativeY = absoluteY - scrollTop;
          
          // Only process if within visible area (with buffer)
          if (relativeY > -textItem.fontSize && relativeY < containerHeight + textItem.fontSize) {
            // Calculate centered X position
            const centeredX = textItem.x + (maxWidth - viewport.width) / 2 + pageHorizontalOffset;
            
            // Measure text width for accurate positioning
            textCtx.font = `${textItem.fontSize}px ${textItem.fontFamily}`;
            const width = textCtx.measureText(textItem.str).width;
            
            allVisibleTextItems.push({
              str: textItem.str,
              x: centeredX,
              y: relativeY,
              width,
              height: textItem.fontSize,
              fontSize: textItem.fontSize,
              fontFamily: textItem.fontFamily,
              pageIndex: textItem.pageIndex
            });
          }
        }

        // Draw page separator line (subtle)
        if (pageIndex > 0) {
          const separatorY = offsetY - scrollTop;
          if (separatorY >= 0 && separatorY <= containerHeight) {
            textCtx.strokeStyle = '#e5e5e5';
            textCtx.lineWidth = 1;
            textCtx.beginPath();
            textCtx.moveTo(pageHorizontalOffset, separatorY);
            textCtx.lineTo(pageHorizontalOffset + maxWidth, separatorY);
            textCtx.stroke();
          }
        }
      }

      // Group text items into lines
      const lines = groupTextIntoLines(allVisibleTextItems);
      textLinesRef.current = lines;
      
      // Only rebuild text model if visible pages changed (performance optimization)
      const currentVisiblePagesKey = visiblePages.map(p => p.pageIndex).sort().join(',');
      if (currentVisiblePagesKey !== lastVisiblePagesRef.current) {
        textModelRef.current.buildFromVisualItems(allVisibleTextItems);
        lastVisiblePagesRef.current = currentVisiblePagesKey;
      }

      // Render all text directly to text canvas
      textCtx.fillStyle = '#1a1a1a';
      allVisibleTextItems.forEach(item => {
        textCtx.font = `${item.fontSize}px ${item.fontFamily}`;
        textCtx.fillText(item.str, item.x, item.y);
      });
    };

    renderTextLayer();
  }, [visiblePages, scale, maxWidth, scrollPosition]);

  // Separate effect for selection rendering (performance optimized)
  useEffect(() => {
    const renderSelection = () => {
      if (!selectionCanvasRef.current || !containerRef.current) return;

      const selectionCanvas = selectionCanvasRef.current;
      const selectionCtx = selectionCanvas.getContext('2d');
      if (!selectionCtx) return;

      // Get container dimensions
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Setup selection canvas to match text canvas exactly
      selectionCanvas.width = containerWidth * devicePixelRatio;
      selectionCanvas.height = containerHeight * devicePixelRatio;
      selectionCanvas.style.width = `${containerWidth}px`;
      selectionCanvas.style.height = `${containerHeight}px`;
      
      selectionCtx.scale(devicePixelRatio, devicePixelRatio);

      // Clear selection canvas
      selectionCtx.clearRect(0, 0, containerWidth, containerHeight);

      // Render selection if exists
      if (selection) {
        drawSelection(selectionCtx, selection);
      }
    };

    renderSelection();
  }, [selection, drawSelection, visiblePages, scrollPosition]);

  // Handle scroll events with performance optimization
  useEffect(() => {
    let scrollTimeout: number | null = null;
    
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      setIsScrolling(true);
      
      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Cancel previous update
      if (scrollUpdateRef.current) {
        cancelAnimationFrame(scrollUpdateRef.current);
      }
      
      // Throttle scroll updates
      scrollUpdateRef.current = requestAnimationFrame(() => {
        const scrollTop = containerRef.current!.scrollTop;
        const containerHeight = containerRef.current!.clientHeight;
        
        // Update scroll position for rendering dependency (throttled)
        setScrollPosition(scrollTop);
        
        // Update current page
        const newCurrentPage = calculateCurrentPage(scrollTop);
        if (newCurrentPage !== currentPage) {
          setCurrentPage(newCurrentPage);
        }
        
        // Update visible pages only if they actually changed
        const newVisiblePages = calculateVisiblePages(scrollTop, containerHeight);
        const visiblePageIndices = newVisiblePages.map(p => p.pageIndex).sort();
        const currentVisibleIndices = visiblePagesRef.current.map(p => p.pageIndex).sort();
        
        if (JSON.stringify(visiblePageIndices) !== JSON.stringify(currentVisibleIndices)) {
          setVisiblePages(newVisiblePages);
          visiblePagesRef.current = newVisiblePages;
        }
      });
      
      // Mark scrolling as finished after 150ms of no scroll events
      scrollTimeout = window.setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }
      };
    }
  }, [calculateCurrentPage, calculateVisiblePages, currentPage]);


  return (
    <div ref={containerRef} className="relative w-full h-full overflow-auto bg-gray-100">
      {/* Invisible scroll spacer to create proper scroll height */}
      <div style={{ height: totalHeight, width: 1, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} />
      
      {/* Fixed canvas container that fills the viewport */}
      <div 
        className="sticky top-0 left-0 w-full"
        style={{ height: '100vh', pointerEvents: 'none' }}
      >
        {/* Text layer - virtualized, only shows visible pages */}
        <canvas
          ref={textCanvasRef}
          className="block"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        />
        {/* Selection layer - transparent overlay with disabled browser selection */}
        <canvas
          ref={selectionCanvasRef}
          className="block cursor-text"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            pointerEvents: 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Page indicator */}
      <div className="fixed bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm font-medium">
        Page {currentPage} of {pages.length}
      </div>

      {/* Memoized selection indicator with legal document smart selection type */}
      {useMemo(() => {
        if (!selection) return null;
        
        const selectedText = getSelectedText();
        const getSelectionTypeIcon = (count: number) => {
          switch (count) {
            case 2: return '📝 Word';
            case 3: return '📄 Sentence';
            case 4: return '⚖️ Clause';
            case 5: return '📜 Section';
            case 6: return '📋 Paragraph';
            default: return '📚 All';
          }
        };
        
        return (
          <div className="fixed top-4 left-4 text-xs text-gray-700 bg-yellow-200 px-2 py-1 rounded shadow border">
            <div className="flex items-center gap-2">
              <span>Selected: {selectedText.length} chars</span>
              {clickCountRef.current > 1 && (
                <span className="text-blue-600 font-medium">
                  {getSelectionTypeIcon(clickCountRef.current)}
                </span>
              )}
            </div>
          </div>
        );
      }, [selection, getSelectedText])}
    </div>
  );
});

const PDFReaderEditor = memo<ContentEditorProps>(({ content, onContentChange, onTitleChange, readOnly, isActive }: ContentEditorProps) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState<number>(1.5);
  const [pages, setPages] = useState<pdfjsLib.PDFPageProxy[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse content to get PDF data
  const pdfData: PDFContent = useMemo(() => {
    try {
      return content ? JSON.parse(content) : {};
    } catch (e) {
      console.error("Failed to parse PDF content JSON:", e);
      return {};
    }
  }, [content]);

  // Load PDF document when content changes
  useEffect(() => {
    const loadPDF = async () => {
      if (!pdfData.base64 && !pdfData.url) {
        setPdfDocument(null);
        setPages([]);
        return;
      }

      if (!isActive) return;

      setLoading(true);
      setError(null);

      try {
        let source;
        if (pdfData.base64) {
          const binaryString = atob(pdfData.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          source = { data: bytes };
        } else if (pdfData.url) {
          source = { url: pdfData.url };
        }

        if (source) {
          console.log('Loading PDF from source:', source);
          const loadingTask = pdfjsLib.getDocument(source);
          const pdf = await loadingTask.promise;
          console.log('PDF loaded successfully:', pdf.numPages, 'pages');
          
          setPdfDocument(pdf);
          
          // Load all pages
          const pagePromises = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            pagePromises.push(pdf.getPage(i));
          }
          const loadedPages = await Promise.all(pagePromises);
          setPages(loadedPages);
        }
      } catch (err) {
        console.error('PDF loading error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setPdfDocument(null);
        setPages([]);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [pdfData.base64, pdfData.url, isActive]);


  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];
        const newContent: PDFContent = { base64: base64Data, title: file.name };
        
        onTitleChange?.(file.name.replace(/\.pdf$/i, ''));
        onContentChange(JSON.stringify(newContent));
      };
      reader.onerror = () => setError('Failed to read PDF file');
      reader.readAsDataURL(file);
    }
  }, [onContentChange, onTitleChange]);

  const handleURLSubmit = useCallback((url: string) => {
    if (url.trim().toLowerCase().endsWith('.pdf')) {
      const newContent: PDFContent = { url: url.trim(), title: 'PDF Document' };
      onContentChange(JSON.stringify(newContent));
    } else {
      setError('Please provide a valid URL ending in .pdf');
    }
  }, [onContentChange]);

  // If no PDF data is provided, show the upload/URL interface
  if (!pdfData.url && !pdfData.base64 && !loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20 text-card-foreground">
        <div className="text-center max-w-md mx-auto p-6 bg-card rounded-xl shadow-sm border">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-muted-foreground"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M10 12v-1a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v1"></path><path d="M14 12v5a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v-5"></path></svg>
          <h3 className="text-lg font-semibold mb-4">Load PDF Document</h3>
          
          {error && <p className="text-sm text-destructive mb-4">{error}</p>}

          {!readOnly && (
            <>
              <label className="block w-full cursor-pointer">
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                <div className="border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/80 hover:bg-muted/50 transition-colors">
                  <div className="text-sm font-medium">Choose a PDF file</div>
                  <div className="text-xs text-muted-foreground">Click to browse your device</div>
                </div>
              </label>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-card text-muted-foreground">or</span></div>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); handleURLSubmit(e.currentTarget.url.value); }}>
                <input name="url" type="url" placeholder="Enter PDF URL" className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background" />
                <button type="submit" className="w-full mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">Load from URL</button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full" style={{ 
      visibility: isActive ? 'visible' : 'hidden', 
      position: isActive ? 'relative' : 'absolute',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Custom PDF viewer with continuous scroll */}
      <div 
        ref={containerRef} 
        className="h-full relative"
      >
        {pages.length > 0 && (
          <>
            {/* Scale controls and selection help */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <div className="flex gap-2 bg-white/90 backdrop-blur rounded-lg shadow-sm border p-2">
                <button 
                  onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
                >
                  -
                </button>
                <span className="px-3 py-1 text-sm font-medium">{Math.round(scale * 100)}%</span>
                <button 
                  onClick={() => setScale(s => Math.min(3, s + 0.25))}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
                >
                  +
                </button>
              </div>
              
              {/* Smart selection help */}
              <div className="bg-blue-50/90 backdrop-blur rounded-lg shadow-sm border border-blue-200 p-2 text-xs text-blue-800 max-w-56">
                <div className="font-medium mb-1">Legal Doc Smart Selection:</div>
                <div>1× Click: Manual select</div>
                <div>2× Click: Select word</div>
                <div>3× Click: Select sentence</div>
                <div>4× Click: Select clause</div>
                <div>5× Click: Select section</div>
                <div>6× Click: Select paragraph</div>
                <div>7× Click: Select all</div>
              </div>
            </div>
            
            {/* Continuous PDF document */}
            <PDFDocumentViewer 
              pages={pages} 
              scale={scale} 
            />
          </>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200/80">
          <div className="text-gray-600 font-medium">Loading PDF...</div>
        </div>
      )}
      
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200/90 p-4">
          <div className="text-center text-destructive bg-card p-6 rounded-lg shadow-lg border border-destructive/50">
            <div className="text-3xl mb-2">⚠️</div>
            <p className="font-semibold">Failed to load document</p>
            <p className="text-xs mt-1 mb-4">{error}</p>
            <button onClick={() => { setError(null); onContentChange('{}'); }} className="text-sm text-primary hover:underline">Try another file</button>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom memo comparison for PDF reader
  return (
    prevProps.content === nextProps.content &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.readOnly === nextProps.readOnly
  );
});


export const pdfReaderContentType: ContentTypeDefinition = {
  metadata: {
    type: 'pdf-reader',
    displayName: 'PDF Reader',
    description: 'View and navigate PDF documents',
    icon: '📄'
  },
  renderEditor: (props: ContentEditorProps) => <PDFReaderEditor {...props} />,
  validateContent: (content: string) => {
    try {
      if (!content || content === '{}') return true;
      const parsed = JSON.parse(content);
      return typeof parsed === 'object' && (!!parsed.url || !!parsed.base64);
    } catch {
      return false;
    }
  },
  getDefaultContent: () => JSON.stringify({}),
  importFrom: (content: string) => {
    const urlRegex = /https?:\/\/[^\s]+\.pdf/gi;
    const matches = content.match(urlRegex);
    if (matches && matches.length > 0) {
      return JSON.stringify({ url: matches[0] });
    }
    return JSON.stringify({});
  },
  exportTo: (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.url) return `PDF Document: ${parsed.url}`;
      if (parsed.title) return `PDF Document: ${parsed.title}`;
      return 'Embedded PDF Document';
    } catch {
      return 'Embedded PDF Document';
    }
  }
};