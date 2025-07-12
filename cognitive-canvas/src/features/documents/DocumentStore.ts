/**
 * High-Performance Document Store
 * 
 * Optimized for the 8ms rule with selective subscriptions and normalized state.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface Document {
  id: string;
  title: string;
  filePath?: string;
  isDirty: boolean;
  isNew: boolean;
  lastModified: number;
  size: number; // Character count for performance monitoring
}

export interface DocumentContent {
  id: string;
  jsonState: string;
  checksum: string; // For change detection
}

export interface DocumentViewState {
  id: string;
  scrollPosition: number;
  cursorPosition: number;
  selection: { start: number; end: number } | null;
  isActive: boolean;
}

interface DocumentState {
  // Normalized state for performance
  documents: Record<string, Document>;
  documentContent: Record<string, DocumentContent>;
  documentViews: Record<string, DocumentViewState>;
  documentOrder: string[];
  activeDocumentId: string | null;
  
  // Performance metrics
  lastUpdateTime: number;
  updateCount: number;
}

interface DocumentActions {
  // Document lifecycle
  createDocument: (title?: string) => string;
  removeDocument: (id: string) => void;
  duplicateDocument: (id: string) => string;
  
  // Document metadata (fast operations)
  updateDocumentMeta: (id: string, updates: Partial<Document>) => void;
  setActiveDocument: (id: string) => void;
  reorderDocuments: (newOrder: string[]) => void;
  
  // Document content (optimistic operations)
  updateDocumentContent: (id: string, jsonState: string) => void;
  updateDocumentView: (id: string, viewState: Partial<DocumentViewState>) => void;
  
  // Batch operations
  markDocumentDirty: (id: string) => void;
  markDocumentClean: (id: string) => void;
  markAllClean: () => void;
  
  // Selectors (memoized)
  getDocument: (id: string) => Document | null;
  getDocumentContent: (id: string) => DocumentContent | null;
  getDocumentView: (id: string) => DocumentViewState | null;
  getActiveDocument: () => Document | null;
  getDirtyDocuments: () => Document[];
  
  // Performance utilities
  getMetrics: () => { lastUpdateTime: number; updateCount: number };
  resetMetrics: () => void;
}

type DocumentStore = DocumentState & DocumentActions;

const initialState: DocumentState = {
  documents: {},
  documentContent: {},
  documentViews: {},
  documentOrder: [],
  activeDocumentId: null,
  lastUpdateTime: 0,
  updateCount: 0
};

// Utility functions
const generateId = (): string => `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const calculateChecksum = (content: string): string => {
  // Simple hash for change detection
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

const createEmptyDocument = (title = 'Untitled'): Document => ({
  id: generateId(),
  title,
  isDirty: false,
  isNew: true,
  lastModified: Date.now(),
  size: 0
});

const createEmptyContent = (id: string): DocumentContent => ({
  id,
  jsonState: '',
  checksum: calculateChecksum('')
});

const createEmptyView = (id: string): DocumentViewState => ({
  id,
  scrollPosition: 0,
  cursorPosition: 0,
  selection: null,
  isActive: false
});

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Document lifecycle
    createDocument: (title) => {
      const document = createEmptyDocument(title);
      const content = createEmptyContent(document.id);
      const view = createEmptyView(document.id);
      
      set(state => ({
        documents: { ...state.documents, [document.id]: document },
        documentContent: { ...state.documentContent, [document.id]: content },
        documentViews: { ...state.documentViews, [document.id]: view },
        documentOrder: [...state.documentOrder, document.id],
        activeDocumentId: document.id,
        lastUpdateTime: performance.now(),
        updateCount: state.updateCount + 1
      }));
      
      return document.id;
    },
    
    removeDocument: (id) => {
      set(state => {
        const newDocuments = { ...state.documents };
        const newContent = { ...state.documentContent };
        const newViews = { ...state.documentViews };
        const newOrder = state.documentOrder.filter(docId => docId !== id);
        
        delete newDocuments[id];
        delete newContent[id];
        delete newViews[id];
        
        // Update active document if removing active one
        let newActiveId = state.activeDocumentId;
        if (state.activeDocumentId === id) {
          newActiveId = newOrder.length > 0 ? newOrder[newOrder.length - 1] : null;
        }
        
        return {
          documents: newDocuments,
          documentContent: newContent,
          documentViews: newViews,
          documentOrder: newOrder,
          activeDocumentId: newActiveId,
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    duplicateDocument: (id) => {
      const state = get();
      const originalDoc = state.documents[id];
      const originalContent = state.documentContent[id];
      
      if (!originalDoc || !originalContent) return '';
      
      const newDoc = createEmptyDocument(`${originalDoc.title} (Copy)`);
      const newContent: DocumentContent = {
        id: newDoc.id,
        jsonState: originalContent.jsonState,
        checksum: originalContent.checksum
      };
      const newView = createEmptyView(newDoc.id);
      
      set(state => ({
        documents: { ...state.documents, [newDoc.id]: newDoc },
        documentContent: { ...state.documentContent, [newDoc.id]: newContent },
        documentViews: { ...state.documentViews, [newDoc.id]: newView },
        documentOrder: [...state.documentOrder, newDoc.id],
        lastUpdateTime: performance.now(),
        updateCount: state.updateCount + 1
      }));
      
      return newDoc.id;
    },
    
    // Fast metadata updates (no content change)
    updateDocumentMeta: (id, updates) => {
      set(state => {
        const document = state.documents[id];
        if (!document) return state;
        
        return {
          documents: {
            ...state.documents,
            [id]: { ...document, ...updates, lastModified: Date.now() }
          },
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    setActiveDocument: (id) => {
      set(state => {
        // Update view states
        const newViews = { ...state.documentViews };
        Object.keys(newViews).forEach(docId => {
          newViews[docId] = { ...newViews[docId], isActive: docId === id };
        });
        
        return {
          documentViews: newViews,
          activeDocumentId: id,
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    reorderDocuments: (newOrder) => {
      set(state => ({
        documentOrder: newOrder,
        lastUpdateTime: performance.now(),
        updateCount: state.updateCount + 1
      }));
    },
    
    // Optimistic content updates
    updateDocumentContent: (id, jsonState) => {
      const newChecksum = calculateChecksum(jsonState);
      
      set(state => {
        const document = state.documents[id];
        const content = state.documentContent[id];
        
        if (!document || !content) return state;
        
        // Skip update if content hasn't actually changed
        if (content.checksum === newChecksum) return state;
        
        return {
          documents: {
            ...state.documents,
            [id]: {
              ...document,
              isDirty: true,
              lastModified: Date.now(),
              size: jsonState.length
            }
          },
          documentContent: {
            ...state.documentContent,
            [id]: { ...content, jsonState, checksum: newChecksum }
          },
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    updateDocumentView: (id, viewState) => {
      set(state => {
        const view = state.documentViews[id];
        if (!view) return state;
        
        return {
          documentViews: {
            ...state.documentViews,
            [id]: { ...view, ...viewState }
          },
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    // Batch operations
    markDocumentDirty: (id) => {
      set(state => {
        const document = state.documents[id];
        if (!document || document.isDirty) return state;
        
        return {
          documents: {
            ...state.documents,
            [id]: { ...document, isDirty: true, lastModified: Date.now() }
          },
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    markDocumentClean: (id) => {
      set(state => {
        const document = state.documents[id];
        if (!document || !document.isDirty) return state;
        
        return {
          documents: {
            ...state.documents,
            [id]: { ...document, isDirty: false }
          },
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    markAllClean: () => {
      set(state => {
        const newDocuments = { ...state.documents };
        let hasChanges = false;
        
        Object.keys(newDocuments).forEach(id => {
          if (newDocuments[id].isDirty) {
            newDocuments[id] = { ...newDocuments[id], isDirty: false };
            hasChanges = true;
          }
        });
        
        if (!hasChanges) return state;
        
        return {
          documents: newDocuments,
          lastUpdateTime: performance.now(),
          updateCount: state.updateCount + 1
        };
      });
    },
    
    // Memoized selectors
    getDocument: (id) => get().documents[id] || null,
    getDocumentContent: (id) => get().documentContent[id] || null,
    getDocumentView: (id) => get().documentViews[id] || null,
    
    getActiveDocument: () => {
      const state = get();
      return state.activeDocumentId ? state.documents[state.activeDocumentId] || null : null;
    },
    
    getDirtyDocuments: () => {
      const state = get();
      return Object.values(state.documents).filter(doc => doc.isDirty);
    },
    
    // Performance utilities
    getMetrics: () => {
      const state = get();
      return {
        lastUpdateTime: state.lastUpdateTime,
        updateCount: state.updateCount
      };
    },
    
    resetMetrics: () => {
      set(() => ({
        lastUpdateTime: performance.now(),
        updateCount: 0
      }));
    }
  }))
);

// Selective subscriptions for performance
export const useDocument = (id: string) => 
  useDocumentStore(state => state.documents[id]);

export const useDocumentContent = (id: string) => 
  useDocumentStore(state => state.documentContent[id]);

export const useDocumentView = (id: string) => 
  useDocumentStore(state => state.documentViews[id]);

export const useActiveDocument = () => 
  useDocumentStore(state => state.getActiveDocument());

export const useDocumentOrder = () => 
  useDocumentStore(state => state.documentOrder);

export const useDirtyDocuments = () => 
  useDocumentStore(state => state.getDirtyDocuments());

// Performance monitoring hook
export const useDocumentStoreMetrics = () => 
  useDocumentStore(state => state.getMetrics());

// Initialize store with first document if empty
export const initializeDocumentStore = () => {
  const state = useDocumentStore.getState();
  if (state.documentOrder.length === 0) {
    state.createDocument('Untitled');
  }
};