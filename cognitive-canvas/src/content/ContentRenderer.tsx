// Content Renderer Component - Renders content based on content type
// Replaces the hardcoded textarea with pluggable content types

import React, { memo } from 'react';
import { contentTypeRegistry, ContentType } from './types';
import { DocumentState } from '../display/DisplayState';

interface ContentRendererProps {
  document: DocumentState;
  onContentChange: (newContent: string) => void;
  onTitleChange?: (newTitle: string) => void;
  isActive: boolean;
  readOnly?: boolean;
}

// Memoized content renderer to prevent unnecessary re-renders
export const ContentRenderer = memo<ContentRendererProps>(({ 
  document, 
  onContentChange, 
  onTitleChange, 
  isActive, 
  readOnly = false 
}: ContentRendererProps) => {
  console.log('🔍 Rendering content type:', document.contentType, 'for document:', document.id);
  console.log('🔍 Full document object:', document);
  
  // Get the content type definition
  const contentTypeDef = contentTypeRegistry.get(document.contentType);
  
  if (!contentTypeDef) {
    console.warn(`❌ Unknown content type: ${document.contentType}, falling back to default`);
    const defaultContentType = contentTypeRegistry.get('default');
    if (!defaultContentType) {
      return (
        <div className="p-4 text-red-500 h-full overflow-y-auto">
          Error: No content type available for rendering
        </div>
      );
    }
    
    return (
      <div className="h-full">
        {defaultContentType.renderEditor({
          documentId: document.id,
          content: document.content,
          onContentChange,
          onTitleChange,
          isActive,
          readOnly
        })}
      </div>
    );
  }

  // Render using the appropriate content type with proper height constraints
  return (
    <div className="h-full" style={{ display: isActive ? 'block' : 'none' }}>
      {contentTypeDef.renderEditor({
        documentId: document.id,
        content: document.content,
        onContentChange,
        onTitleChange,
        isActive,
        readOnly
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return (
    prevProps.document.id === nextProps.document.id &&
    prevProps.document.content === nextProps.document.content &&
    prevProps.document.contentType === nextProps.document.contentType &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.readOnly === nextProps.readOnly
  );
});

// Helper component for content type selection
interface ContentTypeSelectorProps {
  currentType: ContentType;
  onTypeChange: (newType: ContentType) => void;
  disabled?: boolean;
}

export function ContentTypeSelector({ 
  currentType, 
  onTypeChange, 
  disabled = false 
}: ContentTypeSelectorProps) {
  const availableTypes = contentTypeRegistry.getAll();

  return (
    <select
      value={currentType}
      onChange={(e) => onTypeChange(e.target.value as ContentType)}
      disabled={disabled}
      className="text-xs border border-gray-300 rounded px-2 py-1"
      title="Change content type"
    >
      {availableTypes.map((typeDef) => (
        <option key={typeDef.metadata.type} value={typeDef.metadata.type}>
          {typeDef.metadata.icon} {typeDef.metadata.displayName}
        </option>
      ))}
    </select>
  );
}