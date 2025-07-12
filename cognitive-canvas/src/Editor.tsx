import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { EditorState } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { useDocumentStore } from '@/store/documentStore';
import { DebouncedStatePlugin } from '@/plugins/DebouncedStatePlugin';
import { EditorToolbar } from '@/components/EditorToolbar';
import { TableToolbar } from '@/components/TableToolbar';

const theme = {
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph',
  heading: {
    h1: 'text-4xl font-bold mb-4',
    h2: 'text-3xl font-bold mb-3',
    h3: 'text-2xl font-bold mb-2',
  },
  list: {
    nested: {
      listitem: 'nested-list-item',
    },
    ol: 'list-decimal ml-6',
    ul: 'list-disc ml-6',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono',
  },
  quote: 'border-l-4 border-gray-300 pl-4 italic text-gray-700',
  table: 'border-collapse border border-gray-300 w-full my-4',
  tableCell: 'border border-gray-300 p-2 min-w-20',
  tableCellHeader: 'border border-gray-300 p-2 min-w-20 bg-gray-50 font-semibold',
};

function onError(error: Error) {
  console.error(error);
}

interface EditorProps {
  documentId: string;
}

export default function Editor({ documentId }: EditorProps) {
  const { getDocumentById, updateDocument, markDocumentDirty } = useDocumentStore();
  const document = getDocumentById(documentId);

  if (!document) {
    return <div className="p-4 text-gray-500">Document not found</div>;
  }

  const initialConfig = {
    namespace: 'CognitiveCanvasEditor',
    theme,
    onError,
    editorState: document.jsonState || undefined,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      TableNode,
      TableCellNode,
      TableRowNode,
    ],
  };

  const handleStateChange = (editorState: EditorState) => {
    const newJsonState = JSON.stringify(editorState.toJSON());
    
    // Only update if the state has actually changed
    if (newJsonState !== document.jsonState) {
      console.log('Editor state changed for document:', documentId);
      console.log('Document before update:', document);
      updateDocument(documentId, { jsonState: newJsonState });
      markDocumentDirty(documentId);
      console.log('Document marked as dirty');
    }
  };

  return (
    <LexicalComposer initialConfig={initialConfig} key={documentId}>
      <div className="h-full flex flex-col">
        <EditorToolbar />
        <TableToolbar />
        <div className="flex-1 relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="h-full p-6 outline-none text-base leading-relaxed resize-none focus:outline-none"
                style={{ minHeight: '500px' }}
              />
            }
            placeholder={
              <div className="absolute top-6 left-6 text-base text-gray-400 pointer-events-none">
                Start typing your thoughts...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <TablePlugin hasCellMerge={true} hasCellBackgroundColor={true} />
        <DebouncedStatePlugin onStateChange={handleStateChange} debounceMs={250} />
      </div>
    </LexicalComposer>
  );
}