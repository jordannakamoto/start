import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
} from 'lexical';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode, $getNodeByKey } from 'lexical';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Type,
  Table,
  ChevronDown,
} from 'lucide-react';

import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const FONT_FAMILIES = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Source Serif Pro', value: '"Source Serif Pro", serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Playfair Display', value: '"Playfair Display", serif' },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

const FONT_SIZES = [
  '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '42px', '48px'
];

const BLOCK_TYPES = [
  { name: 'Paragraph', value: 'paragraph' },
  { name: 'Heading 1', value: 'h1' },
  { name: 'Heading 2', value: 'h2' },
  { name: 'Heading 3', value: 'h3' },
  { name: 'Quote', value: 'quote' },
];

interface ToolbarState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isCode: boolean;
  blockType: string;
  fontSize: string;
  fontFamily: string;
  canUndo: boolean;
  canRedo: boolean;
}

export function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [toolbarState, setToolbarState] = useState<ToolbarState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isCode: false,
    blockType: 'paragraph',
    fontSize: '16px',
    fontFamily: 'Inter, sans-serif',
    canUndo: false,
    canRedo: false,
  });

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setToolbarState(prev => ({
        ...prev,
        isBold: selection.hasFormat('bold'),
        isItalic: selection.hasFormat('italic'),
        isUnderline: selection.hasFormat('underline'),
        isStrikethrough: selection.hasFormat('strikethrough'),
        isCode: selection.hasFormat('code'),
      }));
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatText = (format: string) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const handleFontFamilyChange = (fontFamily: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.formatText('font-family', fontFamily);
      }
    });
  };

  const handleFontSizeChange = (fontSize: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.formatText('font-size', fontSize);
      }
    });
  };

  const formatElement = (alignment: string) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
  };

  const formatBlock = (blockType: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (blockType === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else if (blockType.startsWith('h')) {
          $setBlocksType(selection, () => $createHeadingNode(blockType as 'h1' | 'h2' | 'h3'));
        } else if (blockType === 'quote') {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      }
    });
  };

  const insertList = (listType: 'bullet' | 'number') => {
    if (listType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: '3',
      rows: '3',
      includeHeaders: true,
    });
  };

  return (
    <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 flex-wrap">
      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          disabled={!toolbarState.canUndo}
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          disabled={!toolbarState.canRedo}
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Font Family */}
      <Select defaultValue="Inter, sans-serif" onValueChange={handleFontFamilyChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((font) => (
            <SelectItem key={font.value} value={font.value}>
              <span style={{ fontFamily: font.value }}>{font.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font Size */}
      <Select defaultValue="16px" onValueChange={handleFontSizeChange}>
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={size}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Block Type */}
      <Select defaultValue="paragraph" onValueChange={formatBlock}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          {BLOCK_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Text Formatting */}
      <div className="flex items-center gap-1">
        <Toggle
          pressed={toolbarState.isBold}
          onPressedChange={() => formatText('bold')}
          size="sm"
        >
          <Bold className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={toolbarState.isItalic}
          onPressedChange={() => formatText('italic')}
          size="sm"
        >
          <Italic className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={toolbarState.isUnderline}
          onPressedChange={() => formatText('underline')}
          size="sm"
        >
          <Underline className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={toolbarState.isStrikethrough}
          onPressedChange={() => formatText('strikethrough')}
          size="sm"
        >
          <Strikethrough className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={toolbarState.isCode}
          onPressedChange={() => formatText('code')}
          size="sm"
        >
          <Code className="w-4 h-4" />
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Alignment */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => formatElement('left')}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => formatElement('center')}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => formatElement('right')}
        >
          <AlignRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => formatElement('justify')}
        >
          <AlignJustify className="w-4 h-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Lists */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertList('bullet')}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertList('number')}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Table */}
      <Button
        variant="ghost"
        size="sm"
        onClick={insertTable}
      >
        <Table className="w-4 h-4" />
      </Button>
    </div>
  );
}