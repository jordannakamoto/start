// Step 3: Content Rendering
// Renders the active content for each panel's active tab

import { registerDrawStep, RenderContext } from '../FirstDrawCoordinator';
import { displayState } from '../DisplayState';
import { PanelRenderer } from './01_PanelRenderer';

// Register the content rendering step
registerDrawStep('Active Content', 3, async (context: RenderContext) => {
  const { state, isFirstDraw } = context;
  const visiblePanels = PanelRenderer.getVisiblePanels();
  
  // Skip verbose logging during first draw for speed
  if (!isFirstDraw) {
    console.log('📄 Rendering content for visible panels:', visiblePanels);
  }

  const contentLayout: Record<string, any> = {};
  
  for (const panelId of visiblePanels) {
    const tabState = state.tabs[panelId];
    const activeTabId = tabState.activeTabId;
    
    if (activeTabId && state.documents[activeTabId]) {
      const document = state.documents[activeTabId];
      contentLayout[panelId] = {
        documentId: activeTabId,
        title: document.title,
        content: document.content,
        contentType: document.contentType,
        lastModified: document.lastModified
      };
      
      if (!isFirstDraw) {
        console.log(`📄 ${panelId} active content:`, document.title);
      }
    } else {
      // No active content
      contentLayout[panelId] = null;
      if (!isFirstDraw) {
        console.log(`📄 ${panelId} has no active content`);
      }
    }
  }

  // Store in global cache
  (window as any).contentLayout = contentLayout;

  // Emit event for React components
  window.dispatchEvent(new CustomEvent('content-rendered', {
    detail: { contentLayout }
  }));
});

// Content state management utilities
export class ContentRenderer {
  // Update document content
  static updateDocumentContent(documentId: string, content: string): void {
    console.log(`📄 Updating content for document: ${documentId}`);
    displayState.updateDocument(documentId, { content });
  }

  // Update document title
  static updateDocumentTitle(documentId: string, title: string): void {
    console.log(`📄 Updating title for document: ${documentId} to "${title}"`);
    displayState.updateDocument(documentId, { title });
  }

  // Update document content type
  static updateDocumentContentType(documentId: string, contentType: 'default' | 'lexical' | 'canvas' | 'ai-assistant'): void {
    console.log(`📄 Updating content type for document: ${documentId} to "${contentType}"`);
    
    // Get current document to verify update
    const currentDoc = displayState.getState().documents[documentId];
    console.log(`📄 Document before update:`, currentDoc);
    
    displayState.updateDocument(documentId, { contentType });
    
    // Verify the update was applied
    const updatedDoc = displayState.getState().documents[documentId];
    console.log(`📄 Document after update:`, updatedDoc);
  }

  // Get active content for a panel
  static getActiveContentForPanel(panelId: 'main' | 'sidebar') {
    const state = displayState.getState();
    const activeTabId = state.tabs[panelId].activeTabId;
    
    if (!activeTabId || !state.documents[activeTabId]) {
      return null;
    }
    
    const result = {
      documentId: activeTabId,
      ...state.documents[activeTabId]
    };
    
    console.log(`📑 getActiveContentForPanel(${panelId}):`, result);
    return result;
  }

  // Get document by ID
  static getDocument(documentId: string) {
    return displayState.getState().documents[documentId] || null;
  }

  // Get all documents
  static getAllDocuments() {
    return displayState.getState().documents;
  }

  // Check if document has unsaved changes (for demonstration)
  static hasUnsavedChanges(documentId: string): boolean {
    const document = displayState.getState().documents[documentId];
    if (!document) return false;
    
    // Simple check: if modified in last 30 seconds, consider unsaved
    return Date.now() - document.lastModified < 30000;
  }

  // Create empty document
  static createDocument(title: string = 'Untitled', content: string = ''): string {
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    displayState.createDocument(documentId, {
      title,
      content,
      lastModified: Date.now()
    });
    
    console.log(`📄 Created document: ${documentId}`);
    return documentId;
  }

  // Delete document
  static deleteDocument(documentId: string): void {
    const state = displayState.getState();
    const newDocuments = { ...state.documents };
    delete newDocuments[documentId];
    
    console.log(`📄 Deleted document: ${documentId}`);
    displayState.setState({ documents: newDocuments });
    
    // Clear from global active if needed
    if (state.activeDocumentId === documentId) {
      displayState.setActiveDocument(null);
    }
  }
}