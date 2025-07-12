import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useState } from 'react';
import { $getSelection, $isRangeSelection } from 'lexical';
import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
} from '@lexical/table';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Rows,
  Columns,
  Trash2,
  Plus,
  Minus,
} from 'lucide-react';

export function TableToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isTableSelected, setIsTableSelected] = useState(false);
  const [tableCellNode, setTableCellNode] = useState(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      let cellNode = $getTableCellNodeFromLexicalNode(anchorNode);
      if (cellNode === null) {
        cellNode = $getTableCellNodeFromLexicalNode(anchorNode.getParent());
      }
      if ($isTableCellNode(cellNode)) {
        setIsTableSelected(true);
        setTableCellNode(cellNode);
        return;
      }
    }
    setIsTableSelected(false);
    setTableCellNode(null);
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const insertTableRowAbove = () => {
    editor.update(() => {
      if (tableCellNode) {
        const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
        $insertTableRow__EXPERIMENTAL(tableRowIndex);
      }
    });
  };

  const insertTableRowBelow = () => {
    editor.update(() => {
      if (tableCellNode) {
        const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
        $insertTableRow__EXPERIMENTAL(tableRowIndex + 1);
      }
    });
  };

  const insertTableColumnBefore = () => {
    editor.update(() => {
      if (tableCellNode) {
        const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);
        $insertTableColumn__EXPERIMENTAL(tableColumnIndex);
      }
    });
  };

  const insertTableColumnAfter = () => {
    editor.update(() => {
      if (tableCellNode) {
        const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);
        $insertTableColumn__EXPERIMENTAL(tableColumnIndex + 1);
      }
    });
  };

  const deleteTableRow = () => {
    editor.update(() => {
      if (tableCellNode) {
        $deleteTableRow__EXPERIMENTAL();
      }
    });
  };

  const deleteTableColumn = () => {
    editor.update(() => {
      if (tableCellNode) {
        $deleteTableColumn__EXPERIMENTAL();
      }
    });
  };

  const deleteTable = () => {
    editor.update(() => {
      if (tableCellNode) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        tableNode.remove();
      }
    });
  };

  if (!isTableSelected) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 p-2 border-b border-blue-200 bg-blue-50 text-sm">
      <span className="text-blue-700 font-medium mr-2">Table Tools:</span>
      
      {/* Row Operations */}
      <Button
        variant="ghost"
        size="sm"
        onClick={insertTableRowAbove}
        title="Insert row above"
      >
        <Plus className="w-3 h-3 mr-1" />
        <Rows className="w-3 h-3" />
        Above
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={insertTableRowBelow}
        title="Insert row below"
      >
        <Plus className="w-3 h-3 mr-1" />
        <Rows className="w-3 h-3" />
        Below
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={deleteTableRow}
        title="Delete row"
      >
        <Minus className="w-3 h-3 mr-1" />
        <Rows className="w-3 h-3" />
      </Button>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Column Operations */}
      <Button
        variant="ghost"
        size="sm"
        onClick={insertTableColumnBefore}
        title="Insert column before"
      >
        <Plus className="w-3 h-3 mr-1" />
        <Columns className="w-3 h-3" />
        Before
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={insertTableColumnAfter}
        title="Insert column after"
      >
        <Plus className="w-3 h-3 mr-1" />
        <Columns className="w-3 h-3" />
        After
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={deleteTableColumn}
        title="Delete column"
      >
        <Minus className="w-3 h-3 mr-1" />
        <Columns className="w-3 h-3" />
      </Button>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Table Operations */}
      <Button
        variant="ghost"
        size="sm"
        onClick={deleteTable}
        title="Delete table"
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-3 h-3 mr-1" />
        Delete Table
      </Button>
    </div>
  );
}