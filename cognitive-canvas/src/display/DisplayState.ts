// Single source of truth for display state
// This is the ONLY state that matters for rendering

import { stateWorkerManager } from './StateWorkerManager';

export interface PanelState {
  width: number;
  visible: boolean;
}

export interface TabState {
  activeTabId: string | null;
  tabIds: string[];
}

export interface DocumentState {
  id: string;
  title: string;
  content: string;
  contentType: 'default' | 'lexical' | 'canvas' | 'ai-assistant';
  lastModified: number;
}

export interface DisplayState {
  // Panel layout (step 1 of rendering)
  panels: {
    main: PanelState;
    sidebar: PanelState;
  };
  
  // Tab state per panel (step 2 of rendering)
  tabs: {
    main: TabState;
    sidebar: TabState;
  };
  
  // Document content (step 3 of rendering)
  documents: Record<string, DocumentState>;
  
  // Global state
  activeDocumentId: string | null;
  version: number;
}

// Default state
export const DEFAULT_DISPLAY_STATE: DisplayState = {
  panels: {
    main: { width: 75, visible: true },
    sidebar: { width: 25, visible: true }
  },
  tabs: {
    main: { activeTabId: null, tabIds: [] },
    sidebar: { activeTabId: null, tabIds: [] }
  },
  documents: {},
  activeDocumentId: null,
  version: 1
};

// State container - single instance
class DisplayStateContainer {
  private static instance: DisplayStateContainer;
  private state: DisplayState = DEFAULT_DISPLAY_STATE;
  private listeners: Set<(state: DisplayState) => void> = new Set();

  private constructor() {
    // Set up worker state loading callback
    stateWorkerManager.onStateLoaded = (loadedState) => {
      if (loadedState) {
        this.state = { ...DEFAULT_DISPLAY_STATE, ...loadedState };
        this.notifyListeners();
      }
    };
  }

  static getInstance(): DisplayStateContainer {
    if (!DisplayStateContainer.instance) {
      DisplayStateContainer.instance = new DisplayStateContainer();
    }
    return DisplayStateContainer.instance;
  }

  // Get current state (read-only)
  getState(): Readonly<DisplayState> {
    return this.state;
  }

  // Update state (triggers re-render)
  setState(newState: Partial<DisplayState>, saveMode: 'sync' | 'async' = 'async'): void {
    this.state = { ...this.state, ...newState, version: this.state.version + 1 };
    this.notifyListeners();
    
    if (saveMode === 'sync') {
      // Critical events: save immediately and synchronously
      stateWorkerManager.saveStateSync(this.state);
    } else {
      // Frequent events: save via web worker (non-blocking)
      stateWorkerManager.saveState(this.state);
    }
  }

  // Update specific panel (sync save - critical for layout)
  updatePanel(panelId: keyof DisplayState['panels'], updates: Partial<PanelState>): void {
    this.setState({
      panels: {
        ...this.state.panels,
        [panelId]: { ...this.state.panels[panelId], ...updates }
      }
    }, 'sync');
  }

  // Update tabs for specific panel (sync save - critical for navigation)
  updateTabs(panelId: keyof DisplayState['tabs'], updates: Partial<TabState>): void {
    this.setState({
      tabs: {
        ...this.state.tabs,
        [panelId]: { ...this.state.tabs[panelId], ...updates }
      }
    }, 'sync');
  }

  // Update document (async save - frequent during typing)
  updateDocument(docId: string, updates: Partial<Omit<DocumentState, 'id'>>): void {
    const existingDoc = this.state.documents[docId] || { 
      id: docId, 
      title: 'Untitled',
      content: '',
      lastModified: Date.now()
    };
    
    this.setState({
      documents: {
        ...this.state.documents,
        [docId]: { ...existingDoc, ...updates, lastModified: Date.now() }
      }
    }, 'async'); // Keep async for typing performance
  }

  // Create document (sync save - critical operation)
  createDocument(docId: string, initialDoc: Partial<Omit<DocumentState, 'id'>>): void {
    const doc = { 
      id: docId, 
      title: 'Untitled',
      content: '',
      contentType: 'default' as const,
      lastModified: Date.now(),
      ...initialDoc
    };
    
    this.setState({
      documents: {
        ...this.state.documents,
        [docId]: doc
      }
    }, 'sync'); // Sync save for document creation
  }

  // Set active document (sync save - critical for navigation)
  setActiveDocument(docId: string | null): void {
    this.setState({ activeDocumentId: docId }, 'sync');
  }

  // Subscribe to state changes
  subscribe(listener: (state: DisplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Load state from storage via web worker
  loadFromStorage(): void {
    stateWorkerManager.loadState();
  }

  // Synchronous fallback methods for when worker isn't available
  loadFromStorageSync(): void {
    try {
      const stored = stateWorkerManager.loadStateSync();
      if (stored) {
        const loadedState = { ...DEFAULT_DISPLAY_STATE, ...stored };
        
        // Migrate documents without contentType to lexical
        if (loadedState.documents) {
          Object.keys(loadedState.documents).forEach(docId => {
            const doc = loadedState.documents[docId];
            if (!doc.contentType) {
              doc.contentType = doc.content ? 'lexical' : 'default';
              console.log(`🔄 Migrated document ${docId} to contentType: ${doc.contentType}`);
            }
          });
        }
        
        this.state = loadedState;
        console.log('📂 Loaded display state from storage (sync)');
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to load display state:', error);
    }
  }

  saveToStorageSync(): void {
    stateWorkerManager.saveStateSync(this.state);
  }

  // Clear all stored data and reset to default state
  clearStorage(): void {
    try {
      localStorage.removeItem('cognitive-canvas-state');
      this.state = DEFAULT_DISPLAY_STATE;
      this.notifyListeners();
      console.log('🗑️ Cleared all stored data and reset to default state');
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
}

// Export singleton instance
export const displayState = DisplayStateContainer.getInstance();