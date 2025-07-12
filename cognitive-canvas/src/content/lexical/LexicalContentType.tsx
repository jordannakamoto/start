// Lexical content type - rich text editor with toolbar
// Uses Lexical for rich text editing capabilities

import React, { useCallback, useEffect, useState } from 'react';
import { $getRoot, EditorState, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ToolbarPlugin } from './ToolbarPlugin';

import { ContentTypeDefinition, ContentEditorProps } from '../types';

// Create editor configuration with initial state and unique namespace
function createEditorConfig(initialContent: string, documentId: string) {
  // Always start with no initial state - we'll handle content in the plugin
  return {
    namespace: `CognitiveCanvas-${documentId}`, // Unique namespace per document
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      AutoLinkNode,
      LinkNode,
    ],
    theme: {
      root: 'border-none outline-none min-h-full',
      paragraph: 'mb-3',
      heading: {
        h1: 'text-3xl font-bold mb-4 mt-6',
        h2: 'text-2xl font-bold mb-3 mt-5',
        h3: 'text-xl font-bold mb-2 mt-4',
        h4: 'text-lg font-bold mb-2 mt-3',
        h5: 'text-base font-bold mb-1 mt-2',
        h6: 'text-sm font-bold mb-1 mt-2',
      },
      list: {
        nested: {
          listitem: 'ml-4',
        },
        ol: 'list-decimal list-inside mb-2',
        ul: 'list-disc list-inside mb-2',
        listitem: 'mb-1',
      },
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono',
      },
      code: 'bg-gray-100 p-3 rounded font-mono text-sm block mb-2',
      quote: 'border-l-4 border-gray-300 pl-4 italic mb-2 text-gray-600',
    },
    onError: (error: Error) => {
      console.error('Lexical error:', error);
      // Don't crash on errors - just log them
    },
  };
}

// Plugin to sync content changes with parent component using JSON serialization
function OnChangeContentPlugin({ onContentChange }: { onContentChange: (content: string) => void }) {
  const [editor] = useLexicalComposerContext();

  const handleChange = useCallback((editorState: EditorState) => {
    const jsonString = JSON.stringify(editorState.toJSON());
    onContentChange(jsonString);
  }, [onContentChange]);

  return <OnChangePlugin onChange={handleChange} />;
}

// Plugin to handle initial content - both JSON state and plain text
function InitialContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (content) {
        try {
          // Try to parse as JSON (Lexical serialized state)
          const parsed = JSON.parse(content);
          if (parsed && parsed.root && parsed.root.children) {
            // Valid Lexical state - parse it
            const editorState = editor.parseEditorState(content);
            editor.setEditorState(editorState);
            console.log('✅ Loaded Lexical state from JSON');
            setIsInitialized(true);
            return;
          }
        } catch {
          // Not valid JSON, treat as plain text
        }

        // Handle as plain text
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(content);
        paragraph.append(textNode);
        root.append(paragraph);
        console.log('✅ Loaded plain text content');
      } else {
        // Empty content - create default paragraph
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        console.log('✅ Created empty document');
      }

      setIsInitialized(true);
    });
  }, [editor, content, isInitialized]);

  return null;
}

function LexicalEditor({ documentId, content, onContentChange, isActive }: ContentEditorProps) {
  const editorConfig = createEditorConfig(content, documentId);
  
  return (
    <div className="h-full flex flex-col">
      <LexicalComposer initialConfig={editorConfig} key={documentId}>
        {/* Toolbar */}
        <div className="flex-shrink-0">
          <ToolbarPlugin />
        </div>
        
        {/* Editor Container with scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="min-h-full p-4 outline-none border-none resize-none"
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
                Start typing...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          
          {/* Plugins */}
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <OnChangeContentPlugin onContentChange={onContentChange} />
          <InitialContentPlugin content={content} />
        </div>
      </LexicalComposer>
    </div>
  );
}

export const lexicalContentType: ContentTypeDefinition = {
  metadata: {
    type: 'lexical',
    displayName: 'Rich Text',
    description: 'Rich text editor with formatting',
    icon: '📖'
  },

  renderEditor: (props: ContentEditorProps) => <LexicalEditor {...props} />,

  validateContent: (content: string) => {
    return typeof content === 'string';
  },

  getDefaultContent: () => '',

  importFrom: (content: string) => {
    // For now, just return the plain text
    // TODO: Could add parsing for markdown or other formats
    return content;
  },

  exportTo: (content: string) => {
    // For now, just return the plain text
    // TODO: Could add export to markdown, HTML, etc.
    return content;
  }
};