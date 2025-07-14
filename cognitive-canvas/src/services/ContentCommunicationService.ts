// Content Communication Service - Inter-content type communication system
// Allows different content types to communicate and share functionality

import { createPDFReaderInstance, type PDFReaderInstance } from '../content/pdf-reader';
import { HIGHLIGHT_COLORS } from '../content/pdf-reader/HighlightAPI';

export type ContentCommunicationEvent = 
  | { type: 'pdf-highlight-test'; payload: { documentId: string } }
  | { type: 'pdf-highlight-add'; payload: { documentId: string; start: number; end: number; options?: any } }
  | { type: 'pdf-highlight-find'; payload: { documentId: string; pattern: string | RegExp; options?: any } }
  | { type: 'pdf-highlight-export'; payload: { documentId: string } }
  | { type: 'pdf-highlight-clear'; payload: { documentId: string } }
  | { type: 'pdf-get-stats'; payload: { documentId: string } };

export type ContentCommunicationResponse = 
  | { type: 'pdf-highlight-result'; payload: { success: boolean; data?: any; error?: string } }
  | { type: 'pdf-stats-result'; payload: { stats: any } };

type EventListener = (event: ContentCommunicationEvent) => Promise<ContentCommunicationResponse | void>;

/**
 * Content Communication Service - Singleton for inter-content communication
 */
class ContentCommunicationService {
  private static instance: ContentCommunicationService;
  private listeners: Map<string, EventListener[]> = new Map();
  private pdfReaderInstances: Map<string, PDFReaderInstance> = new Map();

  private constructor() {}

  static getInstance(): ContentCommunicationService {
    if (!ContentCommunicationService.instance) {
      ContentCommunicationService.instance = new ContentCommunicationService();
    }
    return ContentCommunicationService.instance;
  }

  /**
   * Register a PDF reader instance for a document
   */
  registerPDFReader(documentId: string, instance: PDFReaderInstance): void {
    this.pdfReaderInstances.set(documentId, instance);
    console.log(`📄 Registered PDF reader for document: ${documentId}`);
  }

  /**
   * Unregister a PDF reader instance
   */
  unregisterPDFReader(documentId: string): void {
    this.pdfReaderInstances.delete(documentId);
    console.log(`📄 Unregistered PDF reader for document: ${documentId}`);
  }

  /**
   * Get PDF reader instance for a document
   */
  getPDFReader(documentId: string): PDFReaderInstance | null {
    return this.pdfReaderInstances.get(documentId) || null;
  }

  /**
   * Get all registered PDF readers
   */
  getAllPDFReaders(): Map<string, PDFReaderInstance> {
    return new Map(this.pdfReaderInstances);
  }

  /**
   * Send an event to communicate between content types
   */
  async sendEvent(event: ContentCommunicationEvent): Promise<ContentCommunicationResponse | null> {
    const eventType = event.type;
    const listeners = this.listeners.get(eventType) || [];

    // Handle PDF-specific events
    if (eventType.startsWith('pdf-')) {
      return this.handlePDFEvent(event);
    }

    // Handle other events via listeners
    for (const listener of listeners) {
      try {
        const response = await listener(event);
        if (response) return response;
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    }

    return null;
  }

  /**
   * Handle PDF-specific events
   */
  private async handlePDFEvent(event: ContentCommunicationEvent): Promise<ContentCommunicationResponse> {
    const { payload } = event;
    const documentId = payload.documentId;
    const pdfReader = this.getPDFReader(documentId);

    if (!pdfReader) {
      return {
        type: 'pdf-highlight-result',
        payload: {
          success: false,
          error: `No PDF reader found for document: ${documentId}`
        }
      };
    }

    try {
      switch (event.type) {
        case 'pdf-highlight-test': {
          // Find some actual text in the document to highlight
          const docText = pdfReader.text.getDocument();
          const docLength = pdfReader.text.getLength();
          
          if (docLength === 0) {
            return {
              type: 'pdf-highlight-result',
              payload: {
                success: false,
                error: 'Document has no text content to highlight'
              }
            };
          }

          // Find a good word to highlight (look for common words)
          const testWords = ['the', 'and', 'of', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said'];
          
          let testHighlight = null;
          let foundWord = '';
          
          // Try to find and highlight a common word
          for (const word of testWords) {
            const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
            const match = docText.match(wordRegex);
            
            if (match && match.index !== undefined) {
              const start = match.index;
              const end = start + match[0].length;
              
              // Make sure we're not highlighting at the very beginning (might not be visible)
              if (start > 10) {
                testHighlight = pdfReader.highlight.addByRange(start, end, {
                  color: HIGHLIGHT_COLORS.YELLOW,
                  note: `Test highlight from AI Assistant - word: "${match[0]}"`
                });
                foundWord = match[0];
                break;
              }
            }
          }
          
          // Fallback: highlight the first sentence or first 30 characters
          if (!testHighlight) {
            const start = Math.min(50, Math.max(0, docLength - 100)); // Start somewhere visible
            const end = Math.min(start + 30, docLength);
            
            testHighlight = pdfReader.highlight.addByRange(start, end, {
              color: HIGHLIGHT_COLORS.YELLOW,
              note: 'Test highlight from AI Assistant - fallback highlight'
            });
            foundWord = docText.slice(start, end);
          }

          return {
            type: 'pdf-highlight-result',
            payload: {
              success: true,
              data: {
                message: `Test highlight added successfully! Highlighted: "${foundWord}"`,
                highlightId: testHighlight.id,
                highlightedText: foundWord,
                position: `Characters ${testHighlight.start}-${testHighlight.end}`,
                stats: pdfReader.highlight.getStats()
              }
            }
          };
        }

        case 'pdf-highlight-add': {
          const { start, end, options } = payload as any;
          const highlight = pdfReader.highlight.addByRange(start, end, options);

          return {
            type: 'pdf-highlight-result',
            payload: {
              success: true,
              data: {
                highlight,
                stats: pdfReader.highlight.getStats()
              }
            }
          };
        }

        case 'pdf-highlight-find': {
          const { pattern, options } = payload as any;
          const highlights = pdfReader.highlight.findAndHighlight(pattern, options);

          return {
            type: 'pdf-highlight-result',
            payload: {
              success: true,
              data: {
                highlights,
                count: highlights.length,
                stats: pdfReader.highlight.getStats()
              }
            }
          };
        }

        case 'pdf-highlight-export': {
          const exported = pdfReader.highlight.export();

          return {
            type: 'pdf-highlight-result',
            payload: {
              success: true,
              data: {
                highlights: exported,
                count: exported.length
              }
            }
          };
        }

        case 'pdf-highlight-clear': {
          pdfReader.highlight.clear();

          return {
            type: 'pdf-highlight-result',
            payload: {
              success: true,
              data: {
                message: 'All highlights cleared',
                stats: pdfReader.highlight.getStats()
              }
            }
          };
        }

        case 'pdf-get-stats': {
          const stats = pdfReader.highlight.getStats();

          return {
            type: 'pdf-stats-result',
            payload: { stats }
          };
        }

        default:
          return {
            type: 'pdf-highlight-result',
            payload: {
              success: false,
              error: `Unknown PDF event type: ${event.type}`
            }
          };
      }
    } catch (error) {
      return {
        type: 'pdf-highlight-result',
        payload: {
          success: false,
          error: `Error handling PDF event: ${error}`
        }
      };
    }
  }

  /**
   * Register an event listener
   */
  on(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get available PDF documents for testing
   */
  getAvailablePDFDocuments(): Array<{ documentId: string; hasContent: boolean; stats: any }> {
    const results: Array<{ documentId: string; hasContent: boolean; stats: any }> = [];

    for (const [documentId, pdfReader] of this.pdfReaderInstances) {
      const stats = pdfReader.highlight.getStats();
      const hasContent = pdfReader.text.getLength() > 0;

      results.push({
        documentId,
        hasContent,
        stats
      });
    }

    return results;
  }

  /**
   * Quick test function for AI Assistant
   */
  async testHighlightSystem(): Promise<{
    success: boolean;
    message: string;
    availableDocuments: Array<{ documentId: string; hasContent: boolean; stats: any }>;
    demonstrationResults?: any;
  }> {
    const availableDocuments = this.getAvailablePDFDocuments();
    
    if (availableDocuments.length === 0) {
      return {
        success: false,
        message: 'No PDF documents are currently open. Please open a PDF document first.',
        availableDocuments: []
      };
    }

    // Find a document with content to test on
    const documentWithContent = availableDocuments.find(doc => doc.hasContent);
    
    if (!documentWithContent) {
      return {
        success: false,
        message: 'Found PDF documents but they have no text content loaded yet.',
        availableDocuments
      };
    }

    // Test the highlight system on the first available document
    try {
      const testResult = await this.sendEvent({
        type: 'pdf-highlight-test',
        payload: { documentId: documentWithContent.documentId }
      });

      return {
        success: true,
        message: `Successfully tested highlight system on document: ${documentWithContent.documentId}`,
        availableDocuments,
        demonstrationResults: testResult?.payload
      };
    } catch (error) {
      return {
        success: false,
        message: `Error testing highlight system: ${error}`,
        availableDocuments
      };
    }
  }
}

// Export singleton instance
export const contentCommunicationService = ContentCommunicationService.getInstance();

// Convenience functions for external use
export const pdfHighlight = {
  // Test the highlight system
  test: () => contentCommunicationService.testHighlightSystem(),
  
  // Add highlight to specific document
  add: (documentId: string, start: number, end: number, options?: any) =>
    contentCommunicationService.sendEvent({
      type: 'pdf-highlight-add',
      payload: { documentId, start, end, options }
    }),
  
  // Find and highlight text in document
  findAndHighlight: (documentId: string, pattern: string | RegExp, options?: any) =>
    contentCommunicationService.sendEvent({
      type: 'pdf-highlight-find',
      payload: { documentId, pattern, options }
    }),
  
  // Export highlights from document
  export: (documentId: string) =>
    contentCommunicationService.sendEvent({
      type: 'pdf-highlight-export',
      payload: { documentId }
    }),
  
  // Clear all highlights from document
  clear: (documentId: string) =>
    contentCommunicationService.sendEvent({
      type: 'pdf-highlight-clear',
      payload: { documentId }
    }),
  
  // Get available PDF documents
  getDocuments: () => contentCommunicationService.getAvailablePDFDocuments()
};