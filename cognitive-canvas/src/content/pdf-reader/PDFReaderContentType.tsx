// PDF Reader content type - displays PDF documents
// Uses react-pdf library for PDF rendering

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ContentTypeDefinition, ContentEditorProps } from '../types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker to use the public directory worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFContent {
  url?: string;
  base64?: string;
  title?: string;
}

// Cache for rendered pages
const pageCache = new Map<string, any>();

// Memoized PDF page component for better performance
const MemoizedPage = memo(Page);

// Debounce function for scale changes
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

const PDFReaderEditor = memo<ContentEditorProps>(({ content, onContentChange, onTitleChange, readOnly, isActive }: ContentEditorProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);

  // Parse content to get PDF data
  let pdfData: PDFContent = {};
  try {
    pdfData = content ? JSON.parse(content) : {};
  } catch (e) {
    pdfData = {};
  }

  // Update PDF file when content changes
  useEffect(() => {
    console.log('PDF data updated:', { hasBase64: !!pdfData.base64, hasUrl: !!pdfData.url });
    if (pdfData.base64) {
      setPdfFile(`data:application/pdf;base64,${pdfData.base64}`);
    } else if (pdfData.url) {
      setPdfFile(pdfData.url);
    } else {
      setPdfFile(null);
    }
  }, [pdfData.base64, pdfData.url]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully, pages:', numPages);
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
    
    // Clear page cache when new document loads
    pageCache.clear();
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError(`Failed to load PDF: ${error.message}`);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:application/pdf;base64, prefix
        
        console.log('File read complete, base64 length:', base64Data.length);
        
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

  const changePage = useCallback((offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.max(1, Math.min(newPage, numPages));
    });
  }, [numPages]);

  // Debounced scale change to prevent too many re-renders
  const debouncedSetScale = useMemo(
    () => debounce((newScale: number) => {
      setScale(Math.max(0.5, Math.min(3.0, newScale)));
    }, 100),
    []
  );

  const changeScale = useCallback((newScale: number) => {
    debouncedSetScale(newScale);
  }, [debouncedSetScale]);

  // Preload adjacent pages for smoother navigation
  const preloadPages = useMemo(() => {
    const pages = [];
    if (pageNumber > 1) pages.push(pageNumber - 1);
    if (pageNumber < numPages) pages.push(pageNumber + 1);
    return pages;
  }, [pageNumber, numPages]);

  // If no PDF is loaded, show upload interface
  if (!pdfFile) {
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
      className="h-full flex flex-col bg-gray-100"
      style={{ visibility: isActive ? 'visible' : 'hidden', position: isActive ? 'static' : 'absolute' }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors duration-75"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors duration-75"
          >
            Next
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeScale(scale - 0.1)}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-75"
          >
            -
          </button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => changeScale(scale + 0.1)}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-75"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-4">
        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500 text-center">
              <div className="text-2xl mb-2">⚠️</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {!error && pdfFile && (
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading PDF...</div>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-64">
                <div className="text-red-500">Failed to load PDF</div>
              </div>
            }
            options={{
              cMapUrl: 'cmaps/',
              cMapPacked: true,
            }}
          >
            {/* Current page */}
            <MemoizedPage
              key={`page_${pageNumber}`}
              pageNumber={pageNumber}
              scale={scale}
              loading={<div className="text-gray-500">Loading page...</div>}
              error={<div className="text-red-500">Failed to load page</div>}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              renderMode="canvas"
              width={pageWidth || undefined}
              onRenderSuccess={() => {
                const cacheKey = `${pdfFile}_${pageNumber}_${scale}`;
                pageCache.set(cacheKey, true);
              }}
              onLoadSuccess={(page) => {
                if (!pageWidth) {
                  setPageWidth(page.width);
                }
              }}
            />
            
            {/* Preload adjacent pages (hidden) */}
            {preloadPages.map(preloadPageNum => (
              <div key={`preload_${preloadPageNum}`} style={{ display: 'none' }}>
                <MemoizedPage
                  pageNumber={preloadPageNum}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  renderMode="canvas"
                  width={pageWidth || undefined}
                />
              </div>
            ))}
          </Document>
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