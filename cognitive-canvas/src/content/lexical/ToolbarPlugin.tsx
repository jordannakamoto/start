// Basic formatting toolbar for Lexical editor
// Provides bold, italic, underline, and other basic formatting options

import React, { useCallback, useEffect, useState } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  title: string;
}

function ToolbarButton({ onClick, isActive, children, title }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        px-3 py-1 rounded text-sm font-medium transition-colors
        ${isActive 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }
      `}
    >
      {children}
    </button>
  );
}

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        1
      )
    );
  }, [editor, updateToolbar]);

  const handleFormat = useCallback((format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  return (
    <div className="border-b border-gray-200 p-2 flex gap-2 items-center bg-gray-50">
      <ToolbarButton
        onClick={() => handleFormat('bold')}
        isActive={isBold}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => handleFormat('italic')}
        isActive={isItalic}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => handleFormat('underline')}
        isActive={isUnderline}
        title="Underline (Ctrl+U)"
      >
        <u>U</u>
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <span className="text-xs text-gray-500">
        Rich Text Editor
      </span>
    </div>
  );
}