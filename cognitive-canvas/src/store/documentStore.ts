import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { StateService } from '@/services/stateService'

export interface Document {
  id: string
  filePath?: string
  title: string
  jsonState: string
  isDirty: boolean
  isNew: boolean
}

interface DocumentState {
  documents: Document[]
  activeTabId: string | null
  
  // Actions
  addDocument: (document: Omit<Document, 'id'>) => string
  removeDocument: (id: string) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  setActiveTab: (id: string) => void
  markDocumentDirty: (id: string) => void
  markDocumentClean: (id: string) => void
  getActiveDocument: () => Document | null
  getDocumentById: (id: string) => Document | null
  loadState: () => Promise<void>
  saveState: () => Promise<void>
}

const createEmptyDocument = (): Omit<Document, 'id'> => ({
  title: 'Untitled',
  jsonState: '',
  isDirty: false,
  isNew: true,
})

export const useDocumentStore = create<DocumentState>()(
  subscribeWithSelector(
    devtools(
      (set, get) => ({
      documents: [],
      activeTabId: null,

      addDocument: (document) => {
        const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newDocument: Document = { id, ...document }
        
        set((state) => ({
          documents: [...state.documents, newDocument],
          activeTabId: id,
        }))
        
        return id
      },

      removeDocument: (id) => {
        set((state) => {
          const newDocuments = state.documents.filter(doc => doc.id !== id)
          const newActiveTabId = 
            state.activeTabId === id 
              ? (newDocuments.length > 0 ? newDocuments[newDocuments.length - 1].id : null)
              : state.activeTabId
          
          return {
            documents: newDocuments,
            activeTabId: newActiveTabId,
          }
        })
      },

      updateDocument: (id, updates) => {
        set((state) => ({
          documents: state.documents.map(doc =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
        }))
      },

      setActiveTab: (id) => {
        set({ activeTabId: id })
      },

      markDocumentDirty: (id) => {
        set((state) => ({
          documents: state.documents.map(doc =>
            doc.id === id ? { ...doc, isDirty: true } : doc
          ),
        }))
      },

      markDocumentClean: (id) => {
        set((state) => ({
          documents: state.documents.map(doc =>
            doc.id === id ? { ...doc, isDirty: false } : doc
          ),
        }))
      },

      getActiveDocument: () => {
        const state = get()
        return state.documents.find(doc => doc.id === state.activeTabId) || null
      },

      getDocumentById: (id) => {
        const state = get()
        return state.documents.find(doc => doc.id === id) || null
      },

      loadState: async () => {
        const savedState = await StateService.loadState()
        if (savedState && savedState.documents.length > 0) {
          set({
            documents: savedState.documents,
            activeTabId: savedState.activeTabId || savedState.documents[0]?.id || null,
          })
        }
      },

      saveState: async () => {
        const state = get()
        await StateService.saveState({
          documents: state.documents,
          activeTabId: state.activeTabId,
        })
      },
    }),
      {
        name: 'document-store',
      }
    )
  )
)

// Initialize with one empty document if no state is loaded
export const initializeStore = () => {
  const state = useDocumentStore.getState()
  if (state.documents.length === 0) {
    state.addDocument(createEmptyDocument())
  }
}