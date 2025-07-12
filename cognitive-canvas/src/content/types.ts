// Content Type System - Abstraction for different content editors
// Allows pluggable content types (text, lexical, canvas, etc.)

import { ReactElement } from 'react';

export type ContentType = 'default' | 'lexical' | 'canvas' | 'ai-assistant';

export interface ContentTypeMetadata {
  type: ContentType;
  displayName: string;
  description: string;
  icon?: string;
}

export interface ContentEditorProps {
  documentId: string;
  content: string;
  onContentChange: (newContent: string) => void;
  onTitleChange?: (newTitle: string) => void;
  isActive: boolean;
  readOnly?: boolean;
}

export interface ContentTypeDefinition {
  metadata: ContentTypeMetadata;
  
  // Render the content editor component
  renderEditor: (props: ContentEditorProps) => ReactElement;
  
  // Validate content for this type
  validateContent?: (content: string) => boolean;
  
  // Transform content when switching between types
  importFrom?: (content: string, fromType: ContentType) => string;
  exportTo?: (content: string, toType: ContentType) => string;
  
  // Get default content for new documents
  getDefaultContent?: () => string;
}

// Registry for all available content types
export class ContentTypeRegistry {
  private static instance: ContentTypeRegistry;
  private contentTypes = new Map<ContentType, ContentTypeDefinition>();

  static getInstance(): ContentTypeRegistry {
    if (!ContentTypeRegistry.instance) {
      ContentTypeRegistry.instance = new ContentTypeRegistry();
    }
    return ContentTypeRegistry.instance;
  }

  register(definition: ContentTypeDefinition): void {
    this.contentTypes.set(definition.metadata.type, definition);
    console.log(`📝 Registered content type: ${definition.metadata.type}`);
  }

  get(type: ContentType): ContentTypeDefinition | undefined {
    return this.contentTypes.get(type);
  }

  getAll(): ContentTypeDefinition[] {
    return Array.from(this.contentTypes.values());
  }

  getDefaultType(): ContentType {
    return 'default'; // Default to menu for new tabs
  }
}

// Export singleton instance
export const contentTypeRegistry = ContentTypeRegistry.getInstance();