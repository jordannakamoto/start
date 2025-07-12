// Advanced formatting toolbar for Lexical editor
// Full-featured toolbar with text formatting, lists, alignment, and more

import React, { useCallback, useEffect, useState } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  ListNode,
} from '@lexical/list';
import {
  $isHeadingNode,
  $createHeadingNode,
  HeadingTagType,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode, $getRoot } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
  size?: 'sm' | 'md';
}

function ToolbarButton({ 
  onClick, 
  isActive = false, 
  disabled = false, 
  children, 
  title, 
  size = 'md' 
}: ToolbarButtonProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        ${sizeClasses} rounded font-medium transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isActive 
          ? 'bg-blue-500 text-white shadow-sm' 
          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300'
        }
      `}
    >
      {children}
    </button>
  );
}

function ToolbarDropdown({ 
  value, 
  onChange, 
  options, 
  title 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  options: { value: string; label: string }[];
  title: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      className="px-3 py-2 text-sm border border-gray-200 rounded bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  
  // Text formatting states
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  
  // Block formatting states
  const [blockType, setBlockType] = useState('paragraph');
  const [isInList, setIsInList] = useState(false);
  const [listType, setListType] = useState<'bullet' | 'number' | null>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // Text formatting
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));
      
      // Block formatting
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' 
        ? anchorNode 
        : anchorNode.getTopLevelElementOrThrow();
      
      if ($isHeadingNode(element)) {
        setBlockType(element.getTag());
      } else if ($isListNode(element)) {
        setIsInList(true);
        setListType(element.getListType());
        setBlockType('list');
      } else {
        setIsInList(false);
        setListType(null);
        setBlockType('paragraph');
      }
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

  // Text formatting handlers
  const handleFormat = useCallback((format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  // Block type handler
  const handleBlockType = useCallback((type: string) => {
    if (type === 'paragraph') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    } else if (type.startsWith('h')) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(type as HeadingTagType));
        }
      });
    }
  }, [editor]);

  // List handlers
  const handleList = useCallback((type: 'bullet' | 'number') => {
    if (isInList && listType === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      const command = type === 'bullet' 
        ? INSERT_UNORDERED_LIST_COMMAND 
        : INSERT_ORDERED_LIST_COMMAND;
      editor.dispatchCommand(command, undefined);
    }
  }, [editor, isInList, listType]);

  // Alignment handlers
  const handleAlignment = useCallback((alignment: 'left' | 'center' | 'right' | 'justify') => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
  }, [editor]);

  // Indent handlers
  const handleIndent = useCallback(() => {
    editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
  }, [editor]);

  const handleOutdent = useCallback(() => {
    editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
  }, [editor]);

  const blockTypeOptions = [
    { value: 'paragraph', label: 'Normal' },
    { value: 'h1', label: 'Heading 1' },
    { value: 'h2', label: 'Heading 2' },
    { value: 'h3', label: 'Heading 3' },
    { value: 'h4', label: 'Heading 4' },
    { value: 'h5', label: 'Heading 5' },
    { value: 'h6', label: 'Heading 6' },
  ];

  return (
    <div className="border-b border-gray-200 p-3 flex gap-3 items-center bg-gray-50/50 backdrop-blur-sm">
      {/* Block Type Selector */}
      <ToolbarDropdown
        value={blockType}
        onChange={handleBlockType}
        options={blockTypeOptions}
        title="Text Style"
      />

      <div className="w-px h-6 bg-gray-300" />

      {/* Text Formatting */}
      <div className="flex gap-1">
        <ToolbarButton
          onClick={() => handleFormat('bold')}
          isActive={isBold}
          title="Bold (⌘+B)"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => handleFormat('italic')}
          isActive={isItalic}
          title="Italic (⌘+I)"
        >
          <span className="italic">I</span>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => handleFormat('underline')}
          isActive={isUnderline}
          title="Underline (⌘+U)"
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => handleFormat('strikethrough')}
          isActive={isStrikethrough}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => handleFormat('code')}
          isActive={isCode}
          title="Inline Code"
        >
          <span className="font-mono text-xs">&lt;/&gt;</span>
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* Lists */}
      <div className="flex gap-1">
        <ToolbarButton
          onClick={() => handleList('bullet')}
          isActive={isInList && listType === 'bullet'}
          title="Bullet List"
        >
          <span>•</span>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => handleList('number')}
          isActive={isInList && listType === 'number'}
          title="Numbered List"
        >
          <span className="text-xs">1.</span>
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* Indentation */}
      <div className="flex gap-1">
        <ToolbarButton
          onClick={handleOutdent}
          title="Decrease Indent"
          size="sm"
        >
          <span className="text-xs">⇤</span>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={handleIndent}
          title="Increase Indent"
          size="sm"
        >
          <span className="text-xs">⇥</span>
        </ToolbarButton>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* Alignment */}
      <div className="flex gap-1">
        <ToolbarButton
          onClick={() => handleAlignment('left')}
          title="Align Left"
          size="sm"
        >
          <span className="text-xs">⫷</span>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => handleAlignment('center')}
          title="Align Center"
          size="sm"
        >
          <span className="text-xs">≡</span>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => handleAlignment('right')}
          title="Align Right"
          size="sm"
        >
          <span className="text-xs">⫸</span>
        </ToolbarButton>
      </div>

      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Editor Info */}
      <span className="text-xs text-gray-500 font-medium">
        Rich Text Editor
      </span>
    </div>
  );
}