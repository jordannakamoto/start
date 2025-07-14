// PDF Reader content type - Custom headless PDF.js implementation
// Direct canvas rendering with custom text layer for perfect alignment

import * as pdfjsLib from 'pdfjs-dist';

import { ContentEditorProps, ContentTypeDefinition } from '../types';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FastSelection } from './FastSelection';
import { Selection } from './SelectionAPI';
import { SelectionEventHandler } from './SelectionEventHandler';

// Fast selection system - speed optimized

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
  const fastSelectionRef = useRef<FastSelection>(new FastSelection());
  const eventHandlerRef = useRef<SelectionEventHandler | null>(null);
  const pagesInfoRef = useRef<PageInfo[]>([]);
  const visiblePagesRef = useRef<VisiblePage[]>([]);
  const prerenderedTextRef = useRef<Map<number, any[]>>(new Map());
  const scrollUpdateRef = useRef<number | null>(null);
  const selectionUpdateRef = useRef<number | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [visiblePages, setVisiblePages] = useState<VisiblePage[]>([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [maxWidth, setMaxWidth] = useState(0);

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

  const drawSelection = useCallback((ctx: CanvasRenderingContext2D) => {
    const scrollTop = containerRef.current?.scrollTop || 0;
    const rects = fastSelectionRef.current.getSelectionRects(scrollTop);
    if (rects.length === 0) return;
    
    ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
    
    // Draw all selection rectangles - fast
    for (const rect of rects) {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }, []);

  const getSelectedText = useCallback((): string => {
    return fastSelectionRef.current.getSelectedText();
  }, []);

  // Throttled selection state update for React
  const handleSelectionChange = useCallback((newSelection: Selection | null) => {
    // Cancel any pending update
    if (selectionUpdateRef.current) {
      cancelAnimationFrame(selectionUpdateRef.current);
    }
    
    // Schedule new update
    selectionUpdateRef.current = requestAnimationFrame(() => {
      setSelection(newSelection);
      selectionUpdateRef.current = null;
    });
  }, []);

  // Immediate selection state update for final selection
  const handleSelectionEnd = useCallback((finalSelection: Selection | null) => {
    // Cancel any pending throttled update
    if (selectionUpdateRef.current) {
      cancelAnimationFrame(selectionUpdateRef.current);
      selectionUpdateRef.current = null;
    }
    
    // Set final selection immediately
    setSelection(finalSelection);
  }, []);

  // Initialize event handler
  useEffect(() => {
    if (!eventHandlerRef.current && selectionCanvasRef.current) {
      const selectionCtx = selectionCanvasRef.current.getContext('2d');
      if (selectionCtx) {
        eventHandlerRef.current = new SelectionEventHandler(
          fastSelectionRef.current,
          selectionCtx,
          {
            onSelectionChange: handleSelectionChange,
            onSelectionEnd: handleSelectionEnd
          }
        );
        eventHandlerRef.current.setupGlobalListeners();
      }
    }
    
    // Set canvas elements when available
    if (textCanvasRef.current && selectionCanvasRef.current && eventHandlerRef.current) {
      eventHandlerRef.current.setCanvasElements(textCanvasRef.current, selectionCanvasRef.current);
    }
    
    // Set container reference for scroll position access
    if (containerRef.current && eventHandlerRef.current) {
      eventHandlerRef.current.setContainerRef(containerRef.current);
    }
    
    return () => {
      if (eventHandlerRef.current) {
        eventHandlerRef.current.destroy();
        eventHandlerRef.current = null;
      }
      // Clean up any pending selection updates
      if (selectionUpdateRef.current) {
        cancelAnimationFrame(selectionUpdateRef.current);
        selectionUpdateRef.current = null;
      }
    };
  }, [handleSelectionChange, handleSelectionEnd]);

  // Pre-render all text content to avoid async operations during scroll
  useEffect(() => {
    const preRenderAllText = async () => {
      if (pages.length === 0) return;

      console.log('Pre-rendering text for all pages...');
      const textMap = new Map<number, any[]>();
      
      // Create measurement canvas for pre-calculating text widths
      const measurementCanvas = document.createElement('canvas');
      const measurementCtx = measurementCanvas.getContext('2d');
      if (!measurementCtx) {
        console.error("Failed to create measurement context");
        return;
      }
      
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
        const pageTextItems: any[] = [];
        
        textContent.items.forEach((item: any) => {
          if (item.str.trim()) {
            const [a, , , , e, f] = item.transform;
            const fontSize = Math.abs(a) * scale;
            const x = e * scale;
            const y = viewport.height - f * scale;
            const fontFamily = item.fontName || 'serif';
            
            // Pre-calculate text width
            measurementCtx.font = `${fontSize}px ${fontFamily}`;
            const measuredWidth = measurementCtx.measureText(item.str).width;
            
            pageTextItems.push({
              str: item.str,
              x,
              y,
              width: measuredWidth, // Use the pre-calculated width
              height: fontSize,
              fontSize,
              fontFamily,
              pageIndex,
              globalCharIndex: 0 // Will be set during SelectionAPI initialization
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
      const allVisibleTextItems: any[] = [];
      const textItemsForRendering: any[] = [];

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
            
            // For FastSelection: store absolute coordinates
            // This ensures the selection model has a consistent coordinate system
            // Mouse coordinates will be transformed to absolute in SelectionEventHandler
            allVisibleTextItems.push({
              str: textItem.str,
              x: centeredX,
              y: absoluteY, // Use absolute Y coordinate
              width: textItem.width,
              height: textItem.fontSize,
              fontSize: textItem.fontSize,
              fontFamily: textItem.fontFamily,
              pageIndex: textItem.pageIndex,
              globalCharIndex: 0 // Will be set during SelectionAPI initialization
            });
            
            // For text rendering: store viewport-relative coordinates
            textItemsForRendering.push({
              str: textItem.str,
              x: centeredX,
              y: relativeY, // Use viewport-relative Y coordinate
              fontSize: textItem.fontSize,
              fontFamily: textItem.fontFamily
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

      // Only rebuild FastSelectionAPI if visible pages changed (performance optimization)
      const currentVisiblePagesKey = visiblePages.map(p => p.pageIndex).sort().join(',');
      if (currentVisiblePagesKey !== lastVisiblePagesRef.current) {
        // Initialize fast selection with simple text items
        fastSelectionRef.current.init(allVisibleTextItems);
        lastVisiblePagesRef.current = currentVisiblePagesKey;
      }

      // Render all text directly to text canvas
      textCtx.fillStyle = '#1a1a1a';
      textItemsForRendering.forEach(item => {
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
        drawSelection(selectionCtx);
      }
    };

    renderSelection();
  }, [selection, drawSelection, visiblePages, scrollPosition]);

  // Handle scroll events with performance optimization
  useEffect(() => {
    let scrollTimeout: number | null = null;
    
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      
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
        // Scrolling finished
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
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-auto bg-gray-100"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
      onDragStart={(e: React.DragEvent) => e.preventDefault()}
    >
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
          onMouseDown={eventHandlerRef.current?.handleMouseDown}
          onMouseMove={eventHandlerRef.current?.handleMouseMove}
          onMouseUp={eventHandlerRef.current?.handleMouseUp}
          onMouseLeave={eventHandlerRef.current?.handleMouseLeave}
          onContextMenu={eventHandlerRef.current?.handleContextMenu}
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
        
        return (
          <div className="fixed top-4 left-4 text-xs text-gray-700 bg-yellow-200 px-2 py-1 rounded shadow border">
            <div className="flex items-center gap-2">
              <span>Selected: {selectedText.length} chars</span>
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