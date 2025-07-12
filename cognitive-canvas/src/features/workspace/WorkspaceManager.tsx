/**
 * Workspace Manager
 * 
 * Manages document tabs and workspace state with optimistic updates.
 */

import React, { useCallback, useMemo } from 'react';
import { X, Plus, MoreHorizontal } from 'lucide-react';
import { useDocumentStore, useDocumentOrder, useDocument } from '../documents/DocumentStore';
import { getCommandProcessor, CommandTypes } from '../../core/command/CommandProcessor';

interface WorkspaceManagerProps {
  className?: string;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ className = '' }) => {
  const documentOrder = useDocumentOrder();
  const { setActiveDocument, removeDocument, createDocument } = useDocumentStore();
  const commandProcessor = getCommandProcessor();

  // Optimized tab creation with immediate UI feedback
  const handleCreateDocument = useCallback(() => {
    const documentId = createDocument('Untitled');
    
    // Optimistic UI - tab appears immediately
    // Actual document initialization happens in background
    commandProcessor.execute({
      type: 'document.initialize',
      payload: { documentId },
      priority: 2,
      optimistic: {
        apply: () => {
          // UI already updated by createDocument
        },
        revert: () => {
          removeDocument(documentId);
        },
        description: `Create new document ${documentId}`
      }
    });
  }, [createDocument, removeDocument, commandProcessor]);

  // Optimized tab closing with undo capability
  const handleCloseDocument = useCallback((documentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const document = useDocumentStore.getState().getDocument(documentId);
    if (!document) return;

    // Store document state for potential undo
    const documentState = {
      document,
      content: useDocumentStore.getState().getDocumentContent(documentId),
      view: useDocumentStore.getState().getDocumentView(documentId)
    };

    commandProcessor.execute({
      type: 'document.close',
      payload: { documentId },
      priority: 1,
      optimistic: {
        apply: () => {
          removeDocument(documentId);
        },
        revert: () => {
          // Restore document if operation is cancelled
          // Implementation would restore from documentState
        },
        description: `Close document ${document.title}`
      },
      rollback: {
        execute: async () => {
          // Implementation would restore document from backup
          console.log('Undo close document:', document.title);
        },
        description: `Restore document ${document.title}`
      }
    });
  }, [removeDocument, commandProcessor]);

  const handleTabClick = useCallback((documentId: string) => {
    setActiveDocument(documentId);
  }, [setActiveDocument]);

  return (
    <div className={`flex items-center border-b border-gray-200 bg-gray-50 ${className}`}>
      {/* Document Tabs */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {documentOrder.map((documentId) => (
          <DocumentTab
            key={documentId}
            documentId={documentId}
            onClick={() => handleTabClick(documentId)}
            onClose={(e) => handleCloseDocument(documentId, e)}
          />
        ))}
        
        {/* New Tab Button */}
        <button
          onClick={handleCreateDocument}
          className="flex items-center justify-center w-8 h-8 ml-2 rounded hover:bg-gray-200 transition-colors"
          title="New Document"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Workspace Actions */}
      <div className="flex items-center px-2">
        <button
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-200 transition-colors"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
};

// Optimized tab component with memoization
interface DocumentTabProps {
  documentId: string;
  onClick: () => void;
  onClose: (event: React.MouseEvent) => void;
}

const DocumentTab: React.FC<DocumentTabProps> = React.memo(({ documentId, onClick, onClose }) => {
  const document = useDocument(documentId);
  const activeDocumentId = useDocumentStore(state => state.activeDocumentId);
  
  const isActive = documentId === activeDocumentId;
  
  const tabClasses = useMemo(() => {
    const baseClasses = 'group relative flex items-center px-3 py-2 border-r border-gray-200 cursor-pointer transition-all duration-150';
    const activeClasses = 'bg-white border-b-2 border-blue-500';
    const inactiveClasses = 'bg-gray-50 hover:bg-gray-100';
    
    return `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;
  }, [isActive]);

  if (!document) return null;

  return (
    <div className={tabClasses} onClick={onClick}>
      {/* Document Title */}
      <span 
        className={`text-sm truncate max-w-32 ${isActive ? 'text-gray-900' : 'text-gray-600'}`}
        title={document.title}
      >
        {document.title}
      </span>
      
      {/* Dirty Indicator */}
      {document.isDirty && (
        <div className="w-2 h-2 rounded-full bg-blue-500 ml-2 flex-shrink-0" />
      )}
      
      {/* Close Button */}
      <button
        onClick={onClose}
        className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all flex-shrink-0"
        title="Close document"
      >
        <X className="w-3 h-3 text-gray-500 hover:text-gray-700" />
      </button>
    </div>
  );
});

DocumentTab.displayName = 'DocumentTab';