// Default content type - menu for selecting other content types
// Shown when creating new tabs or documents

import React from 'react';
import { ContentTypeDefinition, ContentEditorProps, ContentType } from '../types';
import { contentTypeRegistry } from '../types';

interface ContentTypeItemProps {
  contentType: ContentTypeDefinition;
  onSelect: (type: ContentType) => void;
}

function ContentTypeItem({ contentType, onSelect }: ContentTypeItemProps) {
  const { metadata } = contentType;
  
  return (
    <button
      onClick={() => onSelect(metadata.type)}
      className="group w-full p-3 hover:bg-gray-50 rounded-lg transition-colors text-left flex items-center gap-3"
    >
      <div className="text-xl">{metadata.icon}</div>
      <div className="flex-1">
        <div className="font-medium text-gray-900 group-hover:text-blue-600">
          {metadata.displayName}
        </div>
        <div className="text-sm text-gray-500">
          {metadata.description}
        </div>
      </div>
    </button>
  );
}

function DefaultEditor({ documentId, onContentChange }: ContentEditorProps) {
  // Get all available content types except 'default'
  const availableTypes = contentTypeRegistry.getAll().filter(ct => ct.metadata.type !== 'default');

  const handleTypeSelect = (selectedType: ContentType) => {
    console.log('🎯 Selected content type:', selectedType);
    
    // Get the content type definition
    const contentTypeDef = contentTypeRegistry.get(selectedType);
    if (!contentTypeDef) {
      console.error('❌ Content type not found:', selectedType);
      return;
    }

    // Get default content for the selected type
    const defaultContent = contentTypeDef.getDefaultContent ? contentTypeDef.getDefaultContent() : '';
    console.log('📄 Default content for', selectedType, ':', defaultContent);
    
    // Update document content and type through the parent
    // We'll pass this information through the content change callback
    // The parent component will handle updating the document type
    const changeInfo = {
      action: 'change-type',
      newType: selectedType,
      newContent: defaultContent
    };
    
    console.log('📤 Sending change info:', changeInfo);
    onContentChange(JSON.stringify(changeInfo));
  };

  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Create New Document</h2>
          <p className="text-sm text-gray-600">Choose a document type</p>
        </div>

        <div className="space-y-1">
          {availableTypes.map((contentType) => (
            <ContentTypeItem
              key={contentType.metadata.type}
              contentType={contentType}
              onSelect={handleTypeSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const defaultContentType: ContentTypeDefinition = {
  metadata: {
    type: 'default',
    displayName: 'New Document',
    description: 'Choose document type',
    icon: '✨'
  },

  renderEditor: (props: ContentEditorProps) => <DefaultEditor {...props} />,

  validateContent: (content: string) => {
    return true; // Always valid
  },

  getDefaultContent: () => '',

  importFrom: (content: string) => content,
  exportTo: (content: string) => content
};