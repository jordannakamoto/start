# Frontend Integration Plan

## Overview

This plan outlines how to integrate the AI Service with the Cognitive Canvas frontend for PDF citation highlighting and AI-assisted summarization.

## Integration Architecture

```
┌─────────────────────────────────────────┐
│          Cognitive Canvas UI            │
├─────────────────────────────────────────┤
│  PDFReaderContentType  │  AIAssistant   │
│  - Display PDF         │  - Chat UI     │
│  - Highlight Citations │  - Summarize   │
└───────────┬────────────┴────────┬───────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────┐
│            AI Service API               │
├─────────────────────────────────────────┤
│  /ingest-pdf          │  /assistant-msg │
│  /api/search/query    │  /api/search/*  │
└─────────────────────────────────────────┘
```

## Phase 1: PDF Ingestion & Indexing

### Frontend Changes (PDFReaderContentType.tsx)

1. **On PDF Load**:
```typescript
// When PDF is loaded in the viewer
async function onPDFLoad(pdfDocument: PDFDocument) {
  // Extract text from all pages
  const pages: Record<number, string> = {};
  
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    pages[i] = textContent.items
      .map(item => item.str)
      .join(' ');
  }
  
  // Send to AI Service for indexing
  const response = await fetch('http://localhost:8000/ingest-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages })
  });
  
  const { job_id } = await response.json();
  // Store job_id for tracking
}
```

2. **Create Search Index**:
```typescript
// After PDF ingestion, create searchable index
async function createSearchIndex(pdfId: string, pages: Record<number, string>) {
  // Parse pages into segments
  const segments = [];
  
  Object.entries(pages).forEach(([pageNum, content]) => {
    const paragraphs = content.split('\n\n');
    paragraphs.forEach((para, paraIdx) => {
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [];
      sentences.forEach((sentence, sentIdx) => {
        segments.push({
          content: sentence.trim(),
          page: parseInt(pageNum),
          paragraph: paraIdx + 1,
          sentence: sentIdx + 1,
          char_start: content.indexOf(sentence),
          char_end: content.indexOf(sentence) + sentence.length
        });
      });
    });
  });
  
  await fetch('http://localhost:8000/api/search/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_id: pdfId, segments })
  });
}
```

## Phase 2: Citation Highlighting

### Frontend Citation Highlighting System

1. **Citation Parser**:
```typescript
interface Citation {
  reference: string;  // "p1.para2.s3"
  page: number;
  paragraph: number;
  sentence: number;
  charRange: [number, number];
}

function parseCitation(ref: string): Citation {
  const match = ref.match(/p(\d+)\.para(\d+)\.s(\d+)/);
  if (!match) return null;
  
  return {
    reference: ref,
    page: parseInt(match[1]),
    paragraph: parseInt(match[2]),
    sentence: parseInt(match[3]),
    charRange: [0, 0]  // Will be populated from search results
  };
}
```

2. **Highlight Manager**:
```typescript
class PDFHighlightManager {
  private highlights: Map<string, Citation[]> = new Map();
  private pdfViewer: PDFViewer;
  
  constructor(pdfViewer: PDFViewer) {
    this.pdfViewer = pdfViewer;
  }
  
  async highlightCitation(citation: Citation, color: string = '#FFEB3B') {
    const page = await this.pdfViewer.getPage(citation.page);
    const textLayer = page.getTextLayer();
    
    // Find text position in PDF
    const textItems = await textLayer.getTextContent();
    let charCount = 0;
    
    for (const item of textItems.items) {
      const itemLength = item.str.length;
      
      if (charCount <= citation.charRange[0] && 
          charCount + itemLength >= citation.charRange[1]) {
        // Create highlight overlay
        const highlight = document.createElement('div');
        highlight.className = 'citation-highlight';
        highlight.style.backgroundColor = color;
        highlight.style.opacity = '0.3';
        highlight.style.position = 'absolute';
        highlight.style.left = `${item.transform[4]}px`;
        highlight.style.top = `${item.transform[5]}px`;
        highlight.style.width = `${item.width}px`;
        highlight.style.height = `${item.height}px`;
        highlight.dataset.citation = citation.reference;
        
        textLayer.append(highlight);
        
        // Add to tracking
        if (!this.highlights.has(citation.reference)) {
          this.highlights.set(citation.reference, []);
        }
        this.highlights.get(citation.reference).push(citation);
      }
      
      charCount += itemLength;
    }
  }
  
  clearHighlights() {
    document.querySelectorAll('.citation-highlight').forEach(el => el.remove());
    this.highlights.clear();
  }
  
  scrollToCitation(citation: Citation) {
    this.pdfViewer.scrollToPage(citation.page);
    // Optionally highlight the citation temporarily
    this.highlightCitation(citation, '#FF5722');
  }
}
```

## Phase 3: AI Assistant Integration

### 1. **Summarize Button**:
```typescript
// In AIAssistantContentType
interface AIAssistantProps {
  currentPDFId?: string;
  onCitationClick?: (citation: Citation) => void;
}

function AIAssistantContentType({ currentPDFId, onCitationClick }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  const handleSummarize = async () => {
    if (!currentPDFId) return;
    
    // Add user message
    setMessages([...messages, {
      role: 'user',
      content: 'Please summarize this PDF with citations'
    }]);
    
    // Call AI service
    const response = await fetch('http://localhost:8000/assistant-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'current-user',
        message: `summarize_pdf:${currentPDFId}`
      })
    });
    
    const { response: aiResponse } = await response.json();
    
    // Parse citations from response
    const citationRegex = /\[p\d+\.para\d+\.s\d+\]/g;
    const citations = [...aiResponse.matchAll(citationRegex)].map(m => m[0]);
    
    // Add AI response with clickable citations
    setMessages([...messages, {
      role: 'assistant',
      content: aiResponse,
      citations: citations.map(c => parseCitation(c.slice(1, -1)))
    }]);
  };
  
  return (
    <div className="ai-assistant">
      <button onClick={handleSummarize}>
        Summarize PDF
      </button>
      
      <div className="messages">
        {messages.map((msg, idx) => (
          <MessageComponent 
            key={idx}
            message={msg}
            onCitationClick={onCitationClick}
          />
        ))}
      </div>
    </div>
  );
}
```

### 2. **Message Component with Citation Links**:
```typescript
function MessageComponent({ message, onCitationClick }) {
  const renderContent = () => {
    if (!message.citations) return message.content;
    
    // Replace citations with clickable links
    let content = message.content;
    const elements = [];
    let lastIndex = 0;
    
    const citationRegex = /\[p\d+\.para\d+\.s\d+\]/g;
    let match;
    
    while ((match = citationRegex.exec(content)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        elements.push(
          <span key={lastIndex}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      // Add clickable citation
      const citation = parseCitation(match[0].slice(1, -1));
      elements.push(
        <button
          key={match.index}
          className="citation-link"
          onClick={() => onCitationClick(citation)}
        >
          {match[0]}
        </button>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      elements.push(
        <span key={lastIndex}>
          {content.slice(lastIndex)}
        </span>
      );
    }
    
    return elements;
  };
  
  return (
    <div className={`message ${message.role}`}>
      {renderContent()}
    </div>
  );
}
```

## Phase 4: Integration Flow

### Main App Integration:
```typescript
function CognitiveCanvas() {
  const [currentPDFId, setCurrentPDFId] = useState<string>();
  const [highlightManager, setHighlightManager] = useState<PDFHighlightManager>();
  
  const handlePDFLoad = async (pdfViewer: PDFViewer, pdfData: any) => {
    // Create highlight manager
    const manager = new PDFHighlightManager(pdfViewer);
    setHighlightManager(manager);
    
    // Ingest PDF
    const pdfId = await ingestPDF(pdfData);
    setCurrentPDFId(pdfId);
  };
  
  const handleCitationClick = (citation: Citation) => {
    if (highlightManager) {
      highlightManager.clearHighlights();
      highlightManager.highlightCitation(citation);
      highlightManager.scrollToCitation(citation);
    }
  };
  
  return (
    <div className="cognitive-canvas">
      <PDFReaderContentType
        onLoad={handlePDFLoad}
        highlightManager={highlightManager}
      />
      
      <AIAssistantContentType
        currentPDFId={currentPDFId}
        onCitationClick={handleCitationClick}
      />
    </div>
  );
}
```

## Implementation Checklist

- [ ] Update PDFReaderContentType to extract and send text to AI Service
- [ ] Implement PDFHighlightManager class
- [ ] Add citation parsing utilities
- [ ] Create summarize button in AI Assistant
- [ ] Implement clickable citation links
- [ ] Add highlight overlays to PDF viewer
- [ ] Test citation navigation and highlighting
- [ ] Add loading states and error handling
- [ ] Implement caching for search results
- [ ] Add citation hover previews

## API Integration Points

1. **PDF Ingestion**: `POST /ingest-pdf`
2. **Search Index**: `POST /api/search/index`
3. **Citation Search**: `POST /api/search/query`
4. **AI Summary**: `POST /assistant-message`
5. **Navigation Map**: `GET /api/search/navigation/{pdf_id}`

## Performance Considerations

1. **Lazy Loading**: Only index visible pages initially
2. **Debounced Search**: Throttle search queries
3. **Citation Caching**: Cache citation lookups
4. **Progressive Enhancement**: Show summary before citations are ready
5. **Batch Operations**: Group citation highlights

## Error Handling

1. Handle PDF parsing failures
2. Graceful degradation if AI Service is unavailable
3. Citation not found fallbacks
4. Network retry logic
5. User feedback for long operations