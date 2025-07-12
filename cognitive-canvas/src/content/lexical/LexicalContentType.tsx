// Lexical content type - rich text editor with toolbar
// Uses Lexical for rich text editing capabilities

import React, { useCallback, useEffect } from 'react';
import { $getRoot, EditorState, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ToolbarPlugin } from './ToolbarPlugin';

import { ContentTypeDefinition, ContentEditorProps } from '../types';

// Create editor configuration with initial state and unique namespace
function createEditorConfig(initialContent: string, documentId: string) {
  let initialEditorState = undefined;
  
  if (initialContent) {
    try {
      // Try to parse as JSON (Lexical state)
      const parsed = JSON.parse(initialContent);
      if (parsed && typeof parsed === 'object') {
        initialEditorState = initialContent;
      }
    } catch {
      // Fall back to undefined for plain text handling
      initialEditorState = undefined;
    }
  }

  return {
    namespace: `CognitiveCanvas-${documentId}`, // Unique namespace per document
    theme: {
      root: 'p-4 border-none outline-none min-h-full',
      paragraph: 'mb-2',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
    },
    editorState: initialEditorState,
    onError: (error: Error) => {
      console.error('Lexical error:', error);
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

// Plugin to handle content that wasn't set in initial config
function PlainTextInitPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Only set content if it's plain text (not JSON)
    if (content && !content.startsWith('{')) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(content);
        paragraph.append(textNode);
        root.append(paragraph);
      });
    }
  }, []); // Only run once on mount

  return null;
}

function LexicalEditor({ documentId, content, onContentChange, isActive }: ContentEditorProps) {
  const editorConfig = createEditorConfig(content, documentId);
  
  return (
    <div className="h-full flex flex-col">
      <LexicalComposer initialConfig={editorConfig} key={documentId}>
        {/* Toolbar */}
        <ToolbarPlugin />
        
        {/* Editor Container */}
        <div className="flex-1 relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="h-full p-4 outline-none border-none resize-none"
                style={{ minHeight: '100%' }}
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
          <OnChangeContentPlugin onContentChange={onContentChange} />
          <PlainTextInitPlugin content={content} />
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