// Content Cache Component - Keeps inactive tab content in memory
// Prevents unnecessary re-renders and unmounting on tab switches

import React, { memo, useRef, useEffect } from 'react';
import { ContentRenderer } from './ContentRenderer';
import { DocumentState } from '../display/DisplayState';

interface ContentCacheProps {
  documents: Record<string, DocumentState>;
  activeDocumentId: string;
  onContentChange: (documentId: string, newContent: string) => void;
  onTitleChange?: (documentId: string, newTitle: string) => void;
  readOnly?: boolean;
}

// Cache to store rendered content components
const contentCache = new Map<string, React.ReactElement>();

export const ContentCache = memo<ContentCacheProps>(({
  documents,
  activeDocumentId,
  onContentChange,
  onTitleChange,
  readOnly = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Clean up cache when documents are removed
  useEffect(() => {
    const documentIds = Object.keys(documents);
    const cachedIds = Array.from(contentCache.keys());
    
    // Remove cached content for documents that no longer exist
    for (const cachedId of cachedIds) {
      if (!documentIds.includes(cachedId)) {
        contentCache.delete(cachedId);
      }
    }
  }, [documents]);

  // Render all documents but only show the active one
  const renderedDocuments = Object.entries(documents).map(([documentId, document]) => {
    const isActive = documentId === activeDocumentId;
    
    // Create content change handler for this specific document
    const handleContentChange = (newContent: string) => {
      onContentChange(documentId, newContent);
    };
    
    const handleTitleChange = onTitleChange ? (newTitle: string) => {
      onTitleChange(documentId, newTitle);
    } : undefined;

    return (
      <div
        key={documentId}
        className="absolute inset-0"
        style={{
          visibility: isActive ? 'visible' : 'hidden',
          zIndex: isActive ? 1 : 0,
          pointerEvents: isActive ? 'auto' : 'none'
        }}
      >
        <ContentRenderer
          document={document}
          onContentChange={handleContentChange}
          onTitleChange={handleTitleChange}
          isActive={isActive}
          readOnly={readOnly}
        />
      </div>
    );
  });

  return (
    <div ref={containerRef} className="h-full relative">
      {renderedDocuments}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if active document changes or document structure changes
  const prevDocIds = Object.keys(prevProps.documents).sort();
  const nextDocIds = Object.keys(nextProps.documents).sort();
  
  return (
    prevProps.activeDocumentId === nextProps.activeDocumentId &&
    prevProps.readOnly === nextProps.readOnly &&
    prevDocIds.length === nextDocIds.length &&
    prevDocIds.every((id, index) => id === nextDocIds[index]) &&
    // Check if content of any document changed
    Object.keys(nextProps.documents).every(id => 
      prevProps.documents[id]?.content === nextProps.documents[id]?.content &&
      prevProps.documents[id]?.contentType === nextProps.documents[id]?.contentType
    )
  );
});