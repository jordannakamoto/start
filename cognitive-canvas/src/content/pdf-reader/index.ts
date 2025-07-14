// PDF Reader Module Exports
// Main exports for external services and components

// Core selection system
export { FastSelection } from './FastSelection';
export { SelectionAPI, type Selection } from './SelectionAPI';
export { TextModel, type TextItem, type TextPosition, type TextLine, type TextPage } from './TextModel';
export { SelectionEventHandler, type SelectionEventHandlerOptions } from './SelectionEventHandler';

// Highlight system
export { 
  HighlightAPI, 
  HIGHLIGHT_COLORS,
  type Highlight, 
  type HighlightRect, 
  type HighlightOptions,
  type HighlightChangeEvent,
  type HighlightListener
} from './HighlightAPI';

// PDF Reader component
export { pdfReaderContentType } from './PDFReaderContentType';

// Convenience function to create a highlight-enabled PDF reader instance
export function createPDFReaderInstance() {
  const fastSelection = new FastSelection();
  return {
    // Core instances
    textModel: fastSelection.getTextModel(),
    selectionAPI: fastSelection.getSelectionAPI(),
    highlightAPI: fastSelection.getHighlightAPI(),
    fastSelection,
    
    // Quick access methods for external services
    highlight: {
      // Add highlight with text range
      addByRange: (start: number, end: number, options?: HighlightOptions) => 
        fastSelection.getHighlightAPI().addHighlight(start, end, options),
      
      // Add highlight for current selection
      addCurrent: (options?: HighlightOptions) => 
        fastSelection.highlightSelection(options),
      
      // Find and highlight text
      findAndHighlight: (pattern: string | RegExp, options?: HighlightOptions) => 
        fastSelection.findAndHighlight(pattern, options),
      
      // Remove highlight
      remove: (id: string) => 
        fastSelection.getHighlightAPI().removeHighlight(id),
      
      // Get all highlights
      getAll: () => 
        fastSelection.getHighlightAPI().getAllHighlights(),
      
      // Export for persistence
      export: () => 
        fastSelection.getHighlightAPI().exportHighlights(),
      
      // Import from persistence
      import: (highlights: any[]) => 
        fastSelection.getHighlightAPI().importHighlights(highlights),
      
      // Clear all highlights
      clear: () => 
        fastSelection.getHighlightAPI().clearAllHighlights(),
      
      // Listen to changes
      onChange: (listener: HighlightListener) => 
        fastSelection.getHighlightAPI().onHighlightChange(listener),
      
      // Get statistics
      getStats: () => 
        fastSelection.getHighlightAPI().getStats()
    },
    
    // Selection methods
    selection: {
      // Set selection
      set: (start: number, end: number) => 
        fastSelection.setSelection(start, end),
      
      // Get current selection
      get: () => 
        fastSelection.getSelection(),
      
      // Clear selection
      clear: () => 
        fastSelection.clearSelection(),
      
      // Get selected text
      getText: () => 
        fastSelection.getSelectedText(),
      
      // Smart selections
      selectWord: (offset: number) => 
        fastSelection.selectWordAt(offset),
      
      selectSentence: (offset: number) => 
        fastSelection.selectSentenceAt(offset),
      
      selectLine: (offset: number) => 
        fastSelection.selectLineAt(offset),
      
      selectAll: () => 
        fastSelection.selectAll()
    },
    
    // Coordinate conversion
    coordsToChar: (x: number, y: number, anchorX?: number, anchorY?: number) => 
      fastSelection.coordsToChar(x, y, anchorX, anchorY),
    
    // Text operations
    text: {
      getDocument: () => 
        fastSelection.getTextModel().getDocumentText(),
      
      getText: (start: number, end: number) => 
        fastSelection.getTextModel().getText(start, end),
      
      getLength: () => 
        fastSelection.getTextModel().getLength(),
      
      getPages: () => 
        fastSelection.getTextModel().getPages()
    }
  };
}

// Type for the created instance
export type PDFReaderInstance = ReturnType<typeof createPDFReaderInstance>;