// Content Type Registry - Register all available content types
// Import and register all content type implementations

import { contentTypeRegistry } from './types';
import { lexicalContentType } from './lexical/LexicalContentType';

// Register all available content types
export function initializeContentTypes() {
  contentTypeRegistry.register(lexicalContentType);
  
  console.log('📝 Content types initialized:', contentTypeRegistry.getAll().map(ct => ct.metadata.type));
}

// Export the registry for easy access
export { contentTypeRegistry } from './types';