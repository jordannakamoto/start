// Ordered Display Component - Uses the First Draw system
// Renders: Panels → Tabs → Content in proper order

import { useEffect, useState, useRef } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { firstDrawCoordinator } from '@/display/FirstDrawCoordinator';
import { PanelRenderer } from '@/display/steps/01_PanelRenderer';
import { TabRenderer } from '@/display/steps/02_TabRenderer';
import { ContentRenderer as ContentRendererStep } from '@/display/steps/03_ContentRenderer';
import { ContentRenderer } from '@/content/ContentRenderer';
import { displayState } from '@/display/DisplayState';

// Import all render steps to ensure they're registered
import '@/display/steps/01_PanelRenderer';
import '@/display/steps/02_TabRenderer';
import '@/display/steps/03_ContentRenderer';

// Simple tab component with editable title
function TabButton({ title, isActive, onActivate, onClose, onTitleChange }: {
  title: string;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onTitleChange: (newTitle: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(title);
  };

  const handleSubmit = () => {
    if (editValue.trim() && editValue !== title) {
      onTitleChange(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  return (
    <div 
      onClick={onActivate}
      className={`px-3 py-2 text-sm border-r cursor-pointer flex items-center gap-2 ${
        isActive ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent border-none outline-none text-sm"
        />
      ) : (
        <span className="flex-1" onDoubleClick={handleDoubleClick}>
          {title}
        </span>
      )}
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="text-gray-400 hover:text-red-500"
      >
        ×
      </button>
    </div>
  );
}

// Tab bar for a panel
function PanelTabBar({ panelId }: { panelId: 'main' | 'sidebar' }) {
  const [tabData, setTabData] = useState<any>(null);

  useEffect(() => {
    const updateTabs = () => {
      const layout = (window as any).tabLayout;
      if (layout && layout[panelId]) {
        setTabData(layout[panelId]);
      }
    };

    // Initial load
    updateTabs();

    // Listen for tab updates
    window.addEventListener('tabs-rendered', updateTabs);
    return () => window.removeEventListener('tabs-rendered', updateTabs);
  }, [panelId]);

  if (!tabData || tabData.tabs.length === 0) {
    return (
      <div className="border-b p-4 text-gray-500 text-center">
        <button 
          onClick={() => {
            TabRenderer.createNewDocumentTab(panelId);
            firstDrawCoordinator.redraw();
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Create Document
        </button>
      </div>
    );
  }

  return (
    <div className="border-b">
      <div className="flex">
        {tabData.tabs.map((tab: any) => (
          <TabButton
            key={tab.id}
            title={tab.title}
            isActive={tab.isActive}
            onActivate={() => {
              TabRenderer.activateTab(panelId, tab.id);
              firstDrawCoordinator.redraw();
            }}
            onClose={() => {
              TabRenderer.removeTab(panelId, tab.id);
              firstDrawCoordinator.redraw();
            }}
            onTitleChange={(newTitle: string) => {
              ContentRendererStep.updateDocumentTitle(tab.id, newTitle);
              firstDrawCoordinator.redraw();
            }}
          />
        ))}
        <button 
          onClick={() => {
            TabRenderer.createNewDocumentTab(panelId);
            firstDrawCoordinator.redraw();
          }}
          className="px-3 py-2 text-gray-400 hover:text-gray-600"
        >
          +
        </button>
      </div>
    </div>
  );
}

// Multi-tab content area that keeps all tabs in memory
function PanelContent({ panelId }: { panelId: 'main' | 'sidebar' }) {
  const [tabData, setTabData] = useState<any>(null);
  const [allDocuments, setAllDocuments] = useState<Record<string, any>>({});

  useEffect(() => {
    const updateTabData = () => {
      const state = displayState.getState();
      const panelTabState = state.tabs[panelId];
      
      // Get all documents for this panel's tabs
      const panelDocuments: Record<string, any> = {};
      for (const tabId of panelTabState.tabIds) {
        if (state.documents[tabId]) {
          panelDocuments[tabId] = {
            id: tabId,
            ...state.documents[tabId]
          };
        }
      }
      
      setTabData(panelTabState);
      setAllDocuments(panelDocuments);
      
      console.log(`📋 PanelContent update for ${panelId}:`, {
        activeTabId: panelTabState.activeTabId,
        tabIds: panelTabState.tabIds,
        documentCount: Object.keys(panelDocuments).length
      });
    };

    // Initial load
    updateTabData();

    // Listen for content updates
    window.addEventListener('content-rendered', updateTabData);
    window.addEventListener('tabs-rendered', updateTabData);
    return () => {
      window.removeEventListener('content-rendered', updateTabData);
      window.removeEventListener('tabs-rendered', updateTabData);
    };
  }, [panelId]);

  if (!tabData || !tabData.activeTabId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No document selected
      </div>
    );
  }

  // Create content change handlers for each document
  const createContentChangeHandler = (documentId: string) => (newContent: string) => {
    // Check if this is a content type change request from default content type
    try {
      const parsed = JSON.parse(newContent);
      if (parsed.action === 'change-type') {
        console.log('🔄 Content type change requested:', parsed.newType, 'with content:', parsed.newContent);
        
        // Handle content type change
        ContentRendererStep.updateDocumentContentType(documentId, parsed.newType);
        ContentRendererStep.updateDocumentContent(documentId, parsed.newContent);
        
        console.log('🔄 Triggering redraw after content type change');
        firstDrawCoordinator.redraw();
        return;
      }
    } catch {
      // Not a JSON change request, treat as normal content
    }
    
    ContentRendererStep.updateDocumentContent(documentId, newContent);
    firstDrawCoordinator.redraw();
  };

  const createTitleChangeHandler = (documentId: string) => (newTitle: string) => {
    ContentRendererStep.updateDocumentTitle(documentId, newTitle);
    firstDrawCoordinator.redraw();
  };

  // Render all documents but only show the active one
  return (
    <div className="h-full flex flex-col relative">
      {Object.entries(allDocuments).map(([documentId, document]) => {
        const isActive = documentId === tabData.activeTabId;
        
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
              document={{
                id: documentId,
                title: document.title,
                content: document.content,
                contentType: document.contentType || 'default',
                lastModified: document.lastModified || Date.now()
              }}
              onContentChange={createContentChangeHandler(documentId)}
              onTitleChange={createTitleChangeHandler(documentId)}
              isActive={isActive}
              readOnly={false}
            />
          </div>
        );
      })}
    </div>
  );
}

// Main panel component
function DisplayPanel({ panelId }: { panelId: 'main' | 'sidebar' }) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0">
        <PanelTabBar panelId={panelId} />
      </div>
      <div className="flex-1 min-h-0">
        <PanelContent panelId={panelId} />
      </div>
    </div>
  );
}

// Main ordered display component
export function OrderedDisplay() {
  const [panelLayout, setPanelLayout] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Execute first draw on mount
  useEffect(() => {
    const executeFirstDraw = async () => {
      await firstDrawCoordinator.executeFirstDraw();
      setIsReady(true);
    };

    executeFirstDraw();
  }, []);

  // Listen for panel layout changes
  useEffect(() => {
    const updatePanels = () => {
      const layout = (window as any).panelLayout;
      if (layout) {
        setPanelLayout(layout);
      }
    };

    // Initial load
    updatePanels();

    // Listen for panel updates
    window.addEventListener('panels-rendered', updatePanels);
    return () => window.removeEventListener('panels-rendered', updatePanels);
  }, []);

  // Handle panel resize
  const handlePanelResize = (sizes: number[]) => {
    if (sizes.length >= 2) {
      PanelRenderer.updatePanelWidth('main', sizes[0]);
      PanelRenderer.updatePanelWidth('sidebar', sizes[1]);
    }
  };

  if (!isReady || !panelLayout) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Initializing display...</div>
      </div>
    );
  }

  const visiblePanels = Object.entries(panelLayout)
    .filter(([_, panel]: [string, any]) => panel.visible)
    .map(([id, panel]: [string, any]) => ({ id, ...panel }));

  if (visiblePanels.length === 0) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">No panels visible</div>
      </div>
    );
  }

  // Single panel
  if (visiblePanels.length === 1) {
    const panel = visiblePanels[0];
    return (
      <div className="h-screen">
        <DisplayPanel panelId={panel.id as 'main' | 'sidebar'} />
      </div>
    );
  }

  // Multi-panel layout
  return (
    <div className="h-screen bg-white">
      <PanelGroup 
        direction="horizontal" 
        className="h-full"
        onLayout={handlePanelResize}
      >
        <Panel 
          defaultSize={panelLayout.main.width} 
          minSize={20}
        >
          <DisplayPanel panelId="main" />
        </Panel>
        
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        
        <Panel 
          defaultSize={panelLayout.sidebar.width} 
          minSize={15}
        >
          <DisplayPanel panelId="sidebar" />
        </Panel>
      </PanelGroup>
    </div>
  );
}