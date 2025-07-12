// Content Renderer Component - Renders content based on content type
// Replaces the hardcoded textarea with pluggable content types

import React from 'react';
import { contentTypeRegistry, ContentType } from './types';
import { DocumentState } from '../display/DisplayState';

interface ContentRendererProps {
  document: DocumentState;
  onContentChange: (newContent: string) => void;
  onTitleChange?: (newTitle: string) => void;
  isActive: boolean;
  readOnly?: boolean;
}

export function ContentRenderer({ 
  document, 
  onContentChange, 
  onTitleChange, 
  isActive, 
  readOnly = false 
}: ContentRendererProps) {
  // Get the content type definition
  const contentTypeDef = contentTypeRegistry.get(document.contentType);
  
  if (!contentTypeDef) {
    console.warn(`Unknown content type: ${document.contentType}, falling back to lexical`);
    const lexicalContentType = contentTypeRegistry.get('lexical');
    if (!lexicalContentType) {
      return (
        <div className="p-4 text-red-500">
          Error: No content type available for rendering
        </div>
      );
    }
    
    return lexicalContentType.renderEditor({
      documentId: document.id,
      content: document.content,
      onContentChange,
      onTitleChange,
      isActive,
      readOnly
    });
  }

  // Render using the appropriate content type
  return contentTypeDef.renderEditor({
    documentId: document.id,
    content: document.content,
    onContentChange,
    onTitleChange,
    isActive,
    readOnly
  });
}

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