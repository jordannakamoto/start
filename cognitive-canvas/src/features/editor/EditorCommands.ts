/**
 * Editor Commands - Text editing operations through Command Palette
 * 
 * All text editing functionality exposed as commands.
 */

import { getCommandRegistry } from '../../core/command/CommandRegistry';
import { FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND } from 'lexical';

export const registerEditorCommands = () => {
  const commandRegistry = getCommandRegistry();

  // Text Formatting
  commandRegistry.register({
    id: 'format.bold',
    title: 'Toggle Bold',
    description: 'Make selected text bold or remove bold formatting',
    category: 'format',
    keywords: ['bold', 'format', 'text', 'style'],
    shortcut: {
      key: 'b',
      cmd: true,
      display: 'Cmd+B'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      // Get the active Lexical editor instance
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
      }
    }
  });

  commandRegistry.register({
    id: 'format.italic',
    title: 'Toggle Italic',
    description: 'Make selected text italic or remove italic formatting',
    category: 'format',
    keywords: ['italic', 'format', 'text', 'style'],
    shortcut: {
      key: 'i',
      cmd: true,
      display: 'Cmd+I'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
      }
    }
  });

  commandRegistry.register({
    id: 'format.underline',
    title: 'Toggle Underline',
    description: 'Underline selected text or remove underline',
    category: 'format',
    keywords: ['underline', 'format', 'text', 'style'],
    shortcut: {
      key: 'u',
      cmd: true,
      display: 'Cmd+U'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
      }
    }
  });

  commandRegistry.register({
    id: 'format.strikethrough',
    title: 'Toggle Strikethrough',
    description: 'Strike through selected text',
    category: 'format',
    keywords: ['strikethrough', 'strike', 'format', 'text'],
    shortcut: {
      key: 'x',
      cmd: true,
      shift: true,
      display: 'Cmd+Shift+X'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
      }
    }
  });

  commandRegistry.register({
    id: 'format.code',
    title: 'Toggle Code',
    description: 'Format selected text as inline code',
    category: 'format',
    keywords: ['code', 'monospace', 'format', 'text'],
    shortcut: {
      key: '`',
      cmd: true,
      display: 'Cmd+`'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
      }
    }
  });

  // Paragraph Formatting
  commandRegistry.register({
    id: 'format.heading1',
    title: 'Heading 1',
    description: 'Format current line as Heading 1',
    category: 'format',
    keywords: ['heading', 'h1', 'title', 'format'],
    shortcut: {
      key: '1',
      cmd: true,
      alt: true,
      display: 'Cmd+Alt+1'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        // Implementation would set heading format
        console.log('Setting heading 1...');
      }
    }
  });

  commandRegistry.register({
    id: 'format.heading2',
    title: 'Heading 2',
    description: 'Format current line as Heading 2',
    category: 'format',
    keywords: ['heading', 'h2', 'subtitle', 'format'],
    shortcut: {
      key: '2',
      cmd: true,
      alt: true,
      display: 'Cmd+Alt+2'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        console.log('Setting heading 2...');
      }
    }
  });

  commandRegistry.register({
    id: 'format.heading3',
    title: 'Heading 3',
    description: 'Format current line as Heading 3',
    category: 'format',
    keywords: ['heading', 'h3', 'subheading', 'format'],
    shortcut: {
      key: '3',
      cmd: true,
      alt: true,
      display: 'Cmd+Alt+3'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        console.log('Setting heading 3...');
      }
    }
  });

  commandRegistry.register({
    id: 'format.paragraph',
    title: 'Normal Paragraph',
    description: 'Format as normal paragraph text',
    category: 'format',
    keywords: ['paragraph', 'normal', 'text', 'format'],
    shortcut: {
      key: '0',
      cmd: true,
      alt: true,
      display: 'Cmd+Alt+0'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        console.log('Setting paragraph...');
      }
    }
  });

  // Lists
  commandRegistry.register({
    id: 'format.bullet-list',
    title: 'Bullet List',
    description: 'Create or toggle bullet point list',
    category: 'format',
    keywords: ['list', 'bullet', 'unordered', 'format'],
    shortcut: {
      key: 'l',
      cmd: true,
      shift: true,
      display: 'Cmd+Shift+L'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        // Implementation would toggle bullet list
        console.log('Toggling bullet list...');
      }
    }
  });

  commandRegistry.register({
    id: 'format.numbered-list',
    title: 'Numbered List',
    description: 'Create or toggle numbered list',
    category: 'format',
    keywords: ['list', 'numbered', 'ordered', 'format'],
    shortcut: {
      key: 'l',
      cmd: true,
      alt: true,
      display: 'Cmd+Alt+L'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        console.log('Toggling numbered list...');
      }
    }
  });

  // Alignment
  commandRegistry.register({
    id: 'format.align-left',
    title: 'Align Left',
    description: 'Left-align current paragraph',
    category: 'format',
    keywords: ['align', 'left', 'format'],
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
      }
    }
  });

  commandRegistry.register({
    id: 'format.align-center',
    title: 'Align Center',
    description: 'Center-align current paragraph',
    category: 'format',
    keywords: ['align', 'center', 'format'],
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
      }
    }
  });

  commandRegistry.register({
    id: 'format.align-right',
    title: 'Align Right',
    description: 'Right-align current paragraph',
    category: 'format',
    keywords: ['align', 'right', 'format'],
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
      }
    }
  });

  // Text Operations
  commandRegistry.register({
    id: 'edit.select-all',
    title: 'Select All',
    description: 'Select all text in the document',
    category: 'edit',
    keywords: ['select', 'all', 'text'],
    shortcut: {
      key: 'a',
      cmd: true,
      display: 'Cmd+A'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        // Implementation would select all text
        console.log('Selecting all text...');
      }
    }
  });

  commandRegistry.register({
    id: 'edit.copy',
    title: 'Copy',
    description: 'Copy selected text to clipboard',
    category: 'edit',
    keywords: ['copy', 'clipboard'],
    shortcut: {
      key: 'c',
      cmd: true,
      display: 'Cmd+C'
    },
    when: {
      hasSelection: true
    },
    execute: async () => {
      // Browser handles this natively, but we can add custom behavior
      document.execCommand('copy');
    }
  });

  commandRegistry.register({
    id: 'edit.cut',
    title: 'Cut',
    description: 'Cut selected text to clipboard',
    category: 'edit',
    keywords: ['cut', 'clipboard'],
    shortcut: {
      key: 'x',
      cmd: true,
      display: 'Cmd+X'
    },
    when: {
      hasSelection: true
    },
    execute: async () => {
      document.execCommand('cut');
    }
  });

  commandRegistry.register({
    id: 'edit.paste',
    title: 'Paste',
    description: 'Paste from clipboard',
    category: 'edit',
    keywords: ['paste', 'clipboard'],
    shortcut: {
      key: 'v',
      cmd: true,
      display: 'Cmd+V'
    },
    when: {
      editorFocused: true
    },
    execute: async () => {
      document.execCommand('paste');
    }
  });

  // Find and Replace
  commandRegistry.register({
    id: 'edit.find',
    title: 'Find',
    description: 'Find text in document',
    category: 'edit',
    keywords: ['find', 'search'],
    shortcut: {
      key: 'f',
      cmd: true,
      display: 'Cmd+F'
    },
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      console.log('Opening find dialog...');
    }
  });

  commandRegistry.register({
    id: 'edit.replace',
    title: 'Find and Replace',
    description: 'Find and replace text in document',
    category: 'edit',
    keywords: ['find', 'replace', 'search'],
    shortcut: {
      key: 'h',
      cmd: true,
      display: 'Cmd+H'
    },
    when: {
      hasActiveDocument: true
    },
    execute: async () => {
      console.log('Opening find and replace dialog...');
    }
  });

  // Tables
  commandRegistry.register({
    id: 'insert.table',
    title: 'Insert Table',
    description: 'Insert a table at cursor position',
    category: 'format',
    keywords: ['table', 'insert', 'grid'],
    when: {
      editorFocused: true
    },
    execute: async () => {
      const editor = getCurrentEditor();
      if (editor) {
        // Implementation would insert table
        console.log('Inserting table...');
      }
    }
  });
};

// Helper function to get current Lexical editor instance
function getCurrentEditor(): any {
  // This would need to be implemented to get the current editor instance
  // For now, return null as placeholder
  return null;
}