// Step 2: Tab Rendering
// Renders tabs within each visible panel

import { registerDrawStep, RenderContext } from '../FirstDrawCoordinator';
import { displayState } from '../DisplayState';
import { PanelRenderer } from './01_PanelRenderer';

// Register the tab rendering step
registerDrawStep('Tab Navigation', 2, async (context: RenderContext) => {
  const { state } = context;
  const visiblePanels = PanelRenderer.getVisiblePanels();
  
  console.log('📑 Rendering tabs for panels:', visiblePanels);

  // Process tabs for each visible panel
  const tabLayout: Record<string, any> = {};
  
  for (const panelId of visiblePanels) {
    const tabState = state.tabs[panelId];
    const tabData = {
      activeTabId: tabState.activeTabId,
      tabIds: tabState.tabIds,
      tabs: tabState.tabIds.map(tabId => ({
        id: tabId,
        title: state.documents[tabId]?.title || 'Untitled',
        isActive: tabId === tabState.activeTabId
      }))
    };
    
    tabLayout[panelId] = tabData;
    console.log(`📑 ${panelId} tabs:`, tabData);
  }

  // Store in global cache
  (window as any).tabLayout = tabLayout;

  // Emit event for React components
  window.dispatchEvent(new CustomEvent('tabs-rendered', {
    detail: { tabLayout }
  }));
});

// Tab state management utilities
export class TabRenderer {
  // Add a new tab to a panel
  static addTab(panelId: 'main' | 'sidebar', documentId: string): void {
    const currentTabs = displayState.getState().tabs[panelId];
    
    // Don't add if already exists
    if (currentTabs.tabIds.includes(documentId)) {
      console.log(`📑 Tab ${documentId} already exists in ${panelId}`);
      return;
    }

    const newTabIds = [...currentTabs.tabIds, documentId];
    
    console.log(`📑 Adding tab ${documentId} to ${panelId}`);
    displayState.updateTabs(panelId, {
      tabIds: newTabIds,
      activeTabId: documentId // Make new tab active
    });
    
    // Also set as global active document
    displayState.setActiveDocument(documentId);
  }

  // Remove a tab from a panel
  static removeTab(panelId: 'main' | 'sidebar', documentId: string): void {
    const currentTabs = displayState.getState().tabs[panelId];
    const newTabIds = currentTabs.tabIds.filter(id => id !== documentId);
    
    let newActiveTabId = currentTabs.activeTabId;
    
    // If we're removing the active tab, pick a new one
    if (currentTabs.activeTabId === documentId) {
      newActiveTabId = newTabIds.length > 0 ? newTabIds[newTabIds.length - 1] : null;
    }

    console.log(`📑 Removing tab ${documentId} from ${panelId}`);
    displayState.updateTabs(panelId, {
      tabIds: newTabIds,
      activeTabId: newActiveTabId
    });

    // Update global active document if needed
    if (displayState.getState().activeDocumentId === documentId) {
      displayState.setActiveDocument(newActiveTabId);
    }
  }

  // Activate a specific tab
  static activateTab(panelId: 'main' | 'sidebar', documentId: string): void {
    const currentState = displayState.getState();
    const panelTabs = currentState.tabs[panelId];
    
    // Check if tab exists in this panel
    if (!panelTabs.tabIds.includes(documentId)) {
      console.warn(`📑 Tab ${documentId} not found in ${panelId} panel:`, panelTabs.tabIds);
      return;
    }
    
    // Check if already active
    if (panelTabs.activeTabId === documentId) {
      console.log(`📑 Tab ${documentId} already active in ${panelId}`);
      return;
    }
    
    console.log(`📑 Activating tab ${documentId} in ${panelId}`);
    displayState.updateTabs(panelId, { activeTabId: documentId });
    displayState.setActiveDocument(documentId);
    
    // Log result
    const newState = displayState.getState();
    console.log(`📑 Tab activation result:`, {
      panel: panelId,
      activeTab: newState.tabs[panelId].activeTabId,
      globalActive: newState.activeDocumentId
    });
  }

  // Get tabs for a specific panel
  static getTabsForPanel(panelId: 'main' | 'sidebar') {
    return displayState.getState().tabs[panelId];
  }

  // Get all tabs across all panels
  static getAllTabs(): Array<{ panelId: string; documentId: string; title: string; isActive: boolean }> {
    const state = displayState.getState();
    const allTabs: Array<{ panelId: string; documentId: string; title: string; isActive: boolean }> = [];
    
    Object.entries(state.tabs).forEach(([panelId, tabState]) => {
      tabState.tabIds.forEach(documentId => {
        allTabs.push({
          panelId,
          documentId,
          title: state.documents[documentId]?.title || 'Untitled',
          isActive: documentId === tabState.activeTabId
        });
      });
    });
    
    return allTabs;
  }

  // Create a new document and add it as a tab
  static createNewDocumentTab(panelId: 'main' | 'sidebar', title: string = 'Untitled'): string {
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create the document
    displayState.updateDocument(documentId, {
      title,
      content: '',
      lastModified: Date.now()
    });
    
    // Add as tab
    this.addTab(panelId, documentId);
    
    console.log(`📑 Created new document tab: ${documentId}`);
    return documentId;
  }
}