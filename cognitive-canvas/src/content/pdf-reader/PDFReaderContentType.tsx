// PDF Reader content type - displays PDF documents
// Uses react-pdf library for PDF rendering

import React, { useState, useCallback, useEffect } from 'react';
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

function PDFReaderEditor({ content, onContentChange, onTitleChange, readOnly }: ContentEditorProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);

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
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError(`Failed to load PDF: ${error.message}`);
    setLoading(false);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setLoading(true);
      
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
        setLoading(false);
      };
      
      reader.onerror = () => {
        setError('Failed to read PDF file');
        setLoading(false);
      };
      
      reader.readAsDataURL(file);
    }
  }, [onContentChange, onTitleChange]);

  const handleURLSubmit = useCallback((url: string) => {
    if (url.trim()) {
      setLoading(true);
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

  const changeScale = useCallback((newScale: number) => {
    setScale(Math.max(0.5, Math.min(3.0, newScale)));
  }, []);

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
    <div className="h-full flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            Next
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeScale(scale - 0.1)}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            -
          </button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => changeScale(scale + 0.1)}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
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
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              loading={<div className="text-gray-500">Loading page...</div>}
              error={<div className="text-red-500">Failed to load page</div>}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}
      </div>
    </div>
  );
}

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