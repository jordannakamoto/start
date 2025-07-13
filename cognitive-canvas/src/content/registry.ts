// Content Type Registry - Register all available content types
// Import and register all content type implementations

import { contentTypeRegistry } from './types';
import { defaultContentType } from './default/DefaultContentType';
import { lexicalContentType } from './lexical/LexicalContentType';
import { aiAssistantContentType } from './ai-assistant/AIAssistantContentType';
import { pdfReaderContentType } from './pdf-reader/PDFReaderContentType';

// Register all available content types
export function initializeContentTypes() {
  contentTypeRegistry.register(defaultContentType);
  contentTypeRegistry.register(lexicalContentType);
  contentTypeRegistry.register(aiAssistantContentType);
  contentTypeRegistry.register(pdfReaderContentType);
  
  console.log('📝 Content types initialized:', contentTypeRegistry.getAll().map(ct => ct.metadata.type));
}

// Export the registry for easy access
export { contentTypeRegistry } from './types';