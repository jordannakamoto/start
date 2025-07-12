import { FolderOpen, Save, Settings as SettingsIcon } from "lucide-react";
import { initializeStore, useDocumentStore } from "@/store/documentStore";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CommandPalette } from './features/command-palette/CommandPalette';
import { DocumentTabs } from "@/components/DocumentTabs";
import { HelpOverlay } from './features/command-palette/HelpOverlay';
import { Settings } from "@/components/Settings";
import { fileService } from "@/services/fileService";
import { getCommandRegistry } from './core/command/CommandRegistry';
import { registerDocumentCommands } from './features/documents/DocumentCommands';
import { registerEditorCommands } from './features/editor/EditorCommands';
import { shortcutsService } from "@/services/shortcutsService";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { useCommandStore } from "@/store/commandStore";
import { useWindowTitle } from "@/hooks/useWindowTitle";

registerDocumentCommands();
registerEditorCommands();

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isCommandPaletteOpen, setCommandPaletteOpen, toggleCommandPalette } = useCommandStore();
  const [isHelpOverlayOpen, setHelpOverlayOpen] = useState(false);
  const commandRegistry = getCommandRegistry();

  const {
    activeTabId,
    updateDocument,
    markDocumentClean,
    getActiveDocument,
    loadState,
    saveState,
    documents,
    addDocument,
  } = useDocumentStore();

  const activeDocument = getActiveDocument();
  useWindowTitle(
    activeDocument?.title || 'Untitled',
    activeDocument?.isDirty || false
  );

  useBeforeUnload();
  
  useEffect(() => {
    const fetchShortcuts = async () => {
      const shortcuts = await shortcutsService.getShortcuts();
      const commandPaletteShortcut = shortcuts.command_palette || "Cmd+P";

      commandRegistry.unregister('core.command-palette');
      commandRegistry.register({
        id: 'core.command-palette',
        title: 'Open Command Palette',
        description: 'Show the command palette',
        category: 'tools',
        keywords: ['palette', 'commands', 'search'],
        shortcut: {
          key: commandPaletteShortcut.split('+')[1].toLowerCase(),
          cmd: commandPaletteShortcut.includes('Cmd'),
          display: commandPaletteShortcut
        },
        execute: toggleCommandPalette,
      });
    };
    fetchShortcuts();
  }, [commandRegistry, toggleCommandPalette]);

  commandRegistry.unregister('core.help');
  commandRegistry.register({
    id: 'core.help',
    title: 'Show Keyboard Shortcuts',
    description: 'Display contextual keyboard shortcuts',
    category: 'help',
    keywords: ['help', 'shortcuts', 'keys'],
    shortcut: {
      key: '?',
      display: '?'
    },
    execute: () => setHelpOverlayOpen(true),
  });

  // Load state on app startup
  useEffect(() => {
    const initApp = async () => {
      await loadState();
      initializeStore(); // Initialize empty document if no state was loaded
    };
    initApp();
  }, [loadState]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save state when documents change
  useEffect(() => {
    if (documents.length > 0) {
      saveState();
    }
  }, [documents, activeTabId, saveState]);

  const handleSave = async () => {
    console.log('Save button clicked!');
    console.log('Active document:', activeDocument);

    if (!activeDocument) {
      console.log('No active document to save');
      return;
    }

    try {
      console.log('Calling fileService.saveDocument...');
      const filePath = await fileService.saveDocument({
        id: activeDocument.id,
        title: activeDocument.title,
        content: activeDocument.jsonState,
        file_path: activeDocument.filePath
      });

      console.log('Save successful, file path:', filePath);
      updateDocument(activeDocument.id, { filePath });
      markDocumentClean(activeDocument.id);
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Save failed: ${error}`);
    }
  };

  const handleLoad = async () => {
    console.log('Open button clicked!');

    try {
      console.log('Calling fileService.loadDocument...');
      const documentData = await fileService.loadDocument();

      console.log('Load successful, document data:', documentData);
      addDocument({
        title: documentData.title,
        jsonState: documentData.content,
        isDirty: false,
        isNew: false,
        filePath: documentData.file_path
      });
    } catch (error) {
      console.error('Load failed:', error);
      alert(`Load failed: ${error}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <HelpOverlay isOpen={isHelpOverlayOpen} onClose={() => setHelpOverlayOpen(false)} />
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <h1 className="text-xl font-semibold text-gray-900">Cognitive Canvas</h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              className="gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Open
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!activeDocument || !activeDocument.isDirty}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Local Vault</span>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <DocumentTabs />
        </div>
      </main>

      {/* Settings Modal */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
