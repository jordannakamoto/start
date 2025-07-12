import { X, Plus, File } from 'lucide-react';
import { useDocumentStore } from '@/store/documentStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Editor from '@/Editor';

export function DocumentTabs() {
  const { 
    documents, 
    activeTabId, 
    setActiveTab, 
    removeDocument, 
    addDocument 
  } = useDocumentStore();

  const handleNewDocument = () => {
    const newDoc = {
      title: `Untitled-${Date.now()}`,
      jsonState: JSON.stringify({
        root: {
          children: [
            {
              children: [],
              direction: null,
              format: '',
              indent: 0,
              type: 'paragraph',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      }),
      isDirty: false,
      isNew: true,
    };
    addDocument(newDoc);
  };

  const handleCloseTab = (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation();
    // TODO: Check if document is dirty and show confirmation dialog
    removeDocument(documentId);
  };

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={handleNewDocument} className="gap-2">
          <Plus className="w-4 h-4" />
          New Document
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center bg-gray-50 border-b border-gray-200 px-2 py-1 gap-1">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer group transition-colors",
              activeTabId === doc.id
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "hover:bg-gray-100 text-gray-600"
            )}
            onClick={() => setActiveTab(doc.id)}
          >
            <File className="w-4 h-4 text-gray-400" />
            
            <span className="text-sm font-medium truncate max-w-32">
              {doc.title}
            </span>
            
            {doc.isDirty && (
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="w-4 h-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-opacity"
              onClick={(e) => handleCloseTab(e, doc.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
        
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 ml-2"
          onClick={handleNewDocument}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {activeTabId && (
          <Editor documentId={activeTabId} />
        )}
      </div>
    </div>
  );
}