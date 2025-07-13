// PDF Reader content type - High-performance PDF.js integration with caching
// Direct PDF.js usage for maximum control and performance

import React, { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ContentTypeDefinition, ContentEditorProps } from '../types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFContent {
  url?: string;
  base64?: string;
  title?: string;
}

// Canvas cache for rendered pages
class PDFPageCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private maxSize = 20;

  private getKey(docId: string, pageNum: number, scale: number): string {
    return `${docId}_${pageNum}_${Math.round(scale * 100)}`;
  }

  get(docId: string, pageNum: number, scale: number): HTMLCanvasElement | null {
    return this.cache.get(this.getKey(docId, pageNum, scale)) || null;
  }

  set(docId: string, pageNum: number, scale: number, canvas: HTMLCanvasElement): void {
    const key = this.getKey(docId, pageNum, scale);
    
    // Clone canvas for cache
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = canvas.width;
    cachedCanvas.height = canvas.height;
    const ctx = cachedCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0);
    }
    
    this.cache.set(key, cachedCanvas);
    
    // Clean up if too large
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clear(docId?: string): void {
    if (docId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(docId)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

const pageCache = new PDFPageCache();

const PDFReaderEditor = memo<ContentEditorProps>(({ content, onContentChange, onTitleChange, readOnly, isActive }: ContentEditorProps) => {
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const scale = 1.2; // Fixed 120% zoom
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const documentId = useRef<string>('');
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Parse content to get PDF data
  const pdfData: PDFContent = useMemo(() => {
    try {
      return content ? JSON.parse(content) : {};
    } catch (e) {
      return {};
    }
  }, [content]);

  // Load PDF document when content changes
  useEffect(() => {
    const loadPDF = async () => {
      if (!pdfData.base64 && !pdfData.url) {
        setPdfDocument(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let loadingTask;
        
        if (pdfData.base64) {
          // Convert base64 to Uint8Array
          const binaryString = atob(pdfData.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          loadingTask = pdfjsLib.getDocument({ data: bytes });
          documentId.current = `base64_${pdfData.base64.substring(0, 32)}`;
        } else if (pdfData.url) {
          loadingTask = pdfjsLib.getDocument(pdfData.url);
          documentId.current = `url_${pdfData.url}`;
        }

        if (loadingTask) {
          const pdf = await loadingTask.promise;
          setPdfDocument(pdf);
          setNumPages(pdf.numPages);
          
          // Clear cache for previous document
          pageCache.clear(documentId.current);
        }
      } catch (err) {
        console.error('PDF loading error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [pdfData.base64, pdfData.url]);

  // Render individual page with text layer
  const renderPage = useCallback(async (pageNum: number, container: HTMLDivElement) => {
    if (!pdfDocument) return;

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const textLayer = container.querySelector('.textLayer') as HTMLDivElement;
    
    if (!canvas || !textLayer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check canvas cache first
    const cachedCanvas = pageCache.get(documentId.current, pageNum, scale);
    if (cachedCanvas) {
      // Use cached canvas - instant display
      canvas.width = cachedCanvas.width;
      canvas.height = cachedCanvas.height;
      ctx.drawImage(cachedCanvas, 0, 0);
      console.log(`📄 Used cached page ${pageNum}`);
    } else {
      try {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        // Set canvas size
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // GPU acceleration hints
        canvas.style.transform = 'translateZ(0)';
        canvas.style.backfaceVisibility = 'hidden';

        // Render page to canvas
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        
        // Cache the rendered page
        pageCache.set(documentId.current, pageNum, scale, canvas);
        console.log(`📄 Rendered and cached page ${pageNum}`);
        
      } catch (err) {
        console.error('Error rendering page canvas:', err);
        return;
      }
    }

    // Render text layer for selection
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Set text layer size to match canvas
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.position = 'absolute';
      textLayer.style.top = '0';
      textLayer.style.left = '0';
      textLayer.style.color = 'transparent';
      textLayer.style.fontSize = '1px';
      textLayer.style.lineHeight = '1';
      textLayer.style.whiteSpace = 'pre';
      textLayer.style.userSelect = 'text';
      textLayer.style.pointerEvents = 'auto';
      
      // Clear previous text content
      textLayer.innerHTML = '';
      
      // Get text content
      const textContent = await page.getTextContent();
      
      // Create text spans manually for better control
      const textItems = textContent.items;
      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i] as any;
        if (item.str) {
          const span = document.createElement('span');
          span.textContent = item.str;
          
          // Transform the coordinates
          const tx = item.transform;
          const x = tx[4];
          const y = viewport.height - tx[5];
          const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
          
          span.style.position = 'absolute';
          span.style.left = `${x}px`;
          span.style.top = `${y - fontSize}px`;
          span.style.fontSize = `${fontSize}px`;
          span.style.fontFamily = item.fontName || 'sans-serif';
          span.style.color = 'transparent';
          span.style.userSelect = 'text';
          span.style.pointerEvents = 'auto';
          
          textLayer.appendChild(span);
        }
      }
      
      console.log(`📄 Rendered text layer for page ${pageNum}`);
      
    } catch (err) {
      console.error('Error rendering text layer:', err);
    }

    // Mark as rendered
    setRenderedPages(prev => new Set(prev).add(pageNum));
  }, [pdfDocument, scale]);

  // Intersection Observer for lazy loading pages
  useEffect(() => {
    if (!pdfDocument) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            const container = entry.target as HTMLDivElement;
            
            if (pageNum > 0 && !renderedPages.has(pageNum)) {
              renderPage(pageNum, container);
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '500px', // Start loading pages 500px before they're visible
        threshold: 0
      }
    );

    // Observe all page containers
    pageRefs.current.forEach((container) => {
      observer.observe(container as Element);
    });

    return () => observer.disconnect();
  }, [pdfDocument, renderPage, renderedPages]);

  // Reset rendered pages when document changes
  useEffect(() => {
    if (numPages > 0) {
      setRenderedPages(new Set()); // Reset rendered pages
    }
  }, [numPages]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:application/pdf;base64, prefix
        
        const newContent: PDFContent = {
          base64: base64Data,
          title: file.name
        };
        
        // Update title
        if (onTitleChange) {
          onTitleChange(file.name.replace('.pdf', ''));
        }
        
        // Update content
        onContentChange(JSON.stringify(newContent));
      };
      
      reader.onerror = () => {
        setError('Failed to read PDF file');
      };
      
      reader.readAsDataURL(file);
    }
  }, [onContentChange, onTitleChange]);

  const handleURLSubmit = useCallback((url: string) => {
    if (url.trim()) {
      const newContent: PDFContent = {
        url: url.trim(),
        title: 'PDF Document'
      };
      
      onContentChange(JSON.stringify(newContent));
    }
  }, [onContentChange]);

  // If no PDF is loaded, show upload interface
  if (!pdfDocument && !loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Load PDF Document</h3>
          
          {!readOnly && (
            <>
              <div className="mb-6">
                <label className="block w-full">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 cursor-pointer transition-colors">
                    <div className="text-sm text-gray-600 mb-2">Choose a PDF file</div>
                    <div className="text-xs text-gray-500">Click to browse</div>
                  </div>
                </label>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">or</span>
                </div>
              </div>
              
              <div className="mt-6">
                <input
                  type="url"
                  placeholder="Enter PDF URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleURLSubmit((e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full bg-gray-200"
      style={{ visibility: isActive ? 'visible' : 'hidden', position: isActive ? 'static' : 'absolute' }}
    >
      {/* Scrollable PDF Viewer */}
      <div 
        ref={scrollContainerRef}
        className="h-full overflow-auto p-4"
        style={{
          scrollBehavior: 'smooth',
          transform: 'translateZ(0)', // GPU acceleration for scroll
        }}
      >
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading PDF...</div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500 text-center">
              <div className="text-2xl mb-2">⚠️</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {pdfDocument && !loading && !error && (
          <div className="max-w-4xl mx-auto">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="mb-4 flex justify-center"
                style={{ minHeight: '600px' }} // Prevent layout shift
              >
                <div
                  className="relative"
                  data-page={pageNum.toString()}
                  ref={(container) => {
                    if (container) {
                      pageRefs.current.set(pageNum, container as any);
                    }
                  }}
                >
                  <canvas
                    className="shadow-lg bg-white max-w-full h-auto block"
                    style={{
                      transform: 'translateZ(0)', // GPU acceleration
                      backfaceVisibility: 'hidden',
                    }}
                  />
                  <div
                    className="textLayer absolute top-0 left-0 overflow-hidden"
                    style={{
                      pointerEvents: 'auto',
                      userSelect: 'text',
                      color: 'transparent',
                      zIndex: 1
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
      const parsed = JSON.parse(content);
      return typeof parsed === 'object' && (parsed.url || parsed.base64);
    } catch {
      return false;
    }
  },

  getDefaultContent: () => JSON.stringify({}),

  importFrom: (content: string) => {
    // Try to extract PDF URLs from content
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
      if (parsed.url) {
        return `PDF Document: ${parsed.url}`;
      }
      if (parsed.title) {
        return `PDF Document: ${parsed.title}`;
      }
      return 'PDF Document';
    } catch {
      return 'PDF Document';
    }
  }
};