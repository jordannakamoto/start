/**
 * Document Commands - Mapping existing functionality to Command Palette
 * 
 * All document operations are exposed through the command system.
 */

import { getCommandRegistry } from '../../core/command/CommandRegistry';
import { useDocumentStore } from './DocumentStore';
import { getCommandProcessor, CommandTypes } from '../../core/command/CommandProcessor';

export const registerDocumentCommands = () => {
  const commandRegistry = getCommandRegistry();
  const commandProcessor = getCommandProcessor();

  // File Operations
  commandRegistry.register({
    id: 'file.new',
    title: 'New Document',
    description: 'Create a new document',
    category: 'file',
    keywords: ['new', 'create', 'document', 'file'],
    shortcut: {
      key: 'n',
      cmd: true,
      display: 'Cmd+N'
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const documentId = store.createDocument();
      console.log(`Created new document: ${documentId}`);
    }
  });

  commandRegistry.register({
    id: 'file.open',
    title: 'Open Document',
    description: 'Open an existing document',
    category: 'file',
    keywords: ['open', 'load', 'document', 'file'],
    shortcut: {
      key: 'o',
      cmd: true,
      display: 'Cmd+O'
    },
    execute: async () => {
      // Implementation would show file picker
      await commandProcessor.execute({
        type: CommandTypes.DOCUMENT_LOAD,
        payload: {},
        priority: 1
      });
    }
  });

  commandRegistry.register({
    id: 'file.save',
    title: 'Save Document',
    description: 'Save the current document',
    category: 'file',
    keywords: ['save', 'write', 'document', 'file'],
    shortcut: {
      key: 's',
      cmd: true,
      display: 'Cmd+S'
    },
    when: {
      hasActiveDocument: true,
      documentDirty: true
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const activeDoc = store.getActiveDocument();
      if (activeDoc) {
        await commandProcessor.execute({
          type: CommandTypes.DOCUMENT_SAVE,
          payload: { documentId: activeDoc.id },
          priority: 0 // Immediate priority for save
        });
      }
    }
  });

  commandRegistry.register({
    id: 'file.save-as',
    title: 'Save Document As...',
    description: 'Save the document with a new name',
    category: 'file',
    keywords: ['save', 'as', 'export', 'copy'],
    shortcut: {
      key: 's',
      cmd: true,
      shift: true,
      display: 'Cmd+Shift+S'
    },
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      // Implementation would show save dialog
      console.log('Save As dialog...');
    }
  });

  commandRegistry.register({
    id: 'file.save-all',
    title: 'Save All Documents',
    description: 'Save all dirty documents',
    category: 'file',
    keywords: ['save', 'all', 'documents'],
    shortcut: {
      key: 's',
      cmd: true,
      alt: true,
      display: 'Cmd+Alt+S'
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const dirtyDocs = store.getDirtyDocuments();
      
      for (const doc of dirtyDocs) {
        await commandProcessor.execute({
          type: CommandTypes.DOCUMENT_SAVE,
          payload: { documentId: doc.id },
          priority: 2
        });
      }
      
      console.log(`Saved ${dirtyDocs.length} documents`);
    }
  });

  // Document Management
  commandRegistry.register({
    id: 'document.close',
    title: 'Close Document',
    description: 'Close the current document',
    category: 'document',
    keywords: ['close', 'document', 'tab'],
    shortcut: {
      key: 'w',
      cmd: true,
      display: 'Cmd+W'
    },
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const activeDoc = store.getActiveDocument();
      if (activeDoc) {
        store.removeDocument(activeDoc.id);
      }
    }
  });

  commandRegistry.register({
    id: 'document.close-others',
    title: 'Close Other Documents',
    description: 'Close all documents except the current one',
    category: 'document',
    keywords: ['close', 'others', 'documents', 'tabs'],
    execute: async () => {
      const store = useDocumentStore.getState();
      const activeDoc = store.getActiveDocument();
      if (!activeDoc) return;

      const allDocs = Object.values(store.documents);
      for (const doc of allDocs) {
        if (doc.id !== activeDoc.id) {
          store.removeDocument(doc.id);
        }
      }
    }
  });

  commandRegistry.register({
    id: 'document.duplicate',
    title: 'Duplicate Document',
    description: 'Create a copy of the current document',
    category: 'document',
    keywords: ['duplicate', 'copy', 'document'],
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const activeDoc = store.getActiveDocument();
      if (activeDoc) {
        const newDocId = store.duplicateDocument(activeDoc.id);
        console.log(`Duplicated document: ${newDocId}`);
      }
    }
  });

  // Tab Navigation
  commandRegistry.register({
    id: 'tab.next',
    title: 'Next Tab',
    description: 'Switch to the next document tab',
    category: 'view',
    keywords: ['tab', 'next', 'switch', 'document'],
    shortcut: {
      key: 'Tab',
      ctrl: true,
      display: 'Ctrl+Tab'
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const currentIndex = store.documentOrder.findIndex(id => id === store.activeDocumentId);
      const nextIndex = (currentIndex + 1) % store.documentOrder.length;
      const nextDocId = store.documentOrder[nextIndex];
      if (nextDocId) {
        store.setActiveDocument(nextDocId);
      }
    }
  });

  commandRegistry.register({
    id: 'tab.previous',
    title: 'Previous Tab',
    description: 'Switch to the previous document tab',
    category: 'view',
    keywords: ['tab', 'previous', 'switch', 'document'],
    shortcut: {
      key: 'Tab',
      ctrl: true,
      shift: true,
      display: 'Ctrl+Shift+Tab'
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const currentIndex = store.documentOrder.findIndex(id => id === store.activeDocumentId);
      const prevIndex = currentIndex === 0 ? store.documentOrder.length - 1 : currentIndex - 1;
      const prevDocId = store.documentOrder[prevIndex];
      if (prevDocId) {
        store.setActiveDocument(prevDocId);
      }
    }
  });

  // Tab shortcuts for quick switching (Cmd+1, Cmd+2, etc.)
  for (let i = 1; i <= 9; i++) {
    commandRegistry.register({
      id: `tab.goto-${i}`,
      title: `Go to Tab ${i}`,
      description: `Switch to document tab ${i}`,
      category: 'view',
      keywords: ['tab', 'goto', 'switch', i.toString()],
      shortcut: {
        key: i.toString(),
        cmd: true,
        display: `Cmd+${i}`
      },
      execute: async () => {
        const store = useDocumentStore.getState();
        const docId = store.documentOrder[i - 1];
        if (docId) {
          store.setActiveDocument(docId);
        }
      }
    });
  }

  // Document Information
  commandRegistry.register({
    id: 'document.info',
    title: 'Document Information',
    description: 'Show document statistics and metadata',
    category: 'tools',
    keywords: ['info', 'statistics', 'metadata', 'document'],
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const activeDoc = store.getActiveDocument();
      const content = store.getDocumentContent(activeDoc?.id || '');
      
      if (activeDoc && content) {
        const stats = {
          title: activeDoc.title,
          size: activeDoc.size,
          modified: new Date(activeDoc.lastModified).toLocaleString(),
          isDirty: activeDoc.isDirty,
          characterCount: content.jsonState.length,
          // Could add word count, paragraph count, etc.
        };
        
        console.log('Document Info:', stats);
        // Implementation would show modal with stats
      }
    }
  });

  // Document Actions
  commandRegistry.register({
    id: 'document.rename',
    title: 'Rename Document',
    description: 'Change the document title',
    category: 'document',
    keywords: ['rename', 'title', 'document'],
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      const store = useDocumentStore.getState();
      const activeDoc = store.getActiveDocument();
      if (activeDoc) {
        // Implementation would show rename dialog
        const newTitle = prompt('New document title:', activeDoc.title);
        if (newTitle && newTitle !== activeDoc.title) {
          store.updateDocumentMeta(activeDoc.id, { title: newTitle });
        }
      }
    }
  });

  // Recent Documents
  commandRegistry.register({
    id: 'file.recent',
    title: 'Recent Documents',
    description: 'Show recently opened documents',
    category: 'file',
    keywords: ['recent', 'history', 'documents'],
    shortcut: {
      key: 'r',
      cmd: true,
      shift: true,
      display: 'Cmd+Shift+R'
    },
    execute: async () => {
      // Implementation would show recent documents list
      console.log('Showing recent documents...');
    }
  });
};