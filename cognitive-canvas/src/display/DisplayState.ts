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
  setState(newState: Partial<DisplayState>): void {
    this.state = { ...this.state, ...newState, version: this.state.version + 1 };
    this.notifyListeners();
    // Immediate save via web worker (non-blocking)
    stateWorkerManager.saveState(this.state);
  }

  // Update specific panel
  updatePanel(panelId: keyof DisplayState['panels'], updates: Partial<PanelState>): void {
    this.setState({
      panels: {
        ...this.state.panels,
        [panelId]: { ...this.state.panels[panelId], ...updates }
      }
    });
  }

  // Update tabs for specific panel
  updateTabs(panelId: keyof DisplayState['tabs'], updates: Partial<TabState>): void {
    this.setState({
      tabs: {
        ...this.state.tabs,
        [panelId]: { ...this.state.tabs[panelId], ...updates }
      }
    });
  }

  // Update document
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
    });
  }

  // Set active document
  setActiveDocument(docId: string | null): void {
    this.setState({ activeDocumentId: docId });
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
        this.state = { ...DEFAULT_DISPLAY_STATE, ...stored };
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
}

// Export singleton instance
export const displayState = DisplayStateContainer.getInstance();