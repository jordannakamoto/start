# Work Order: AI Service Frontend Integration

## Objective
Integrate the AI service backend with the Cognitive Canvas frontend to enable PDF citation highlighting and AI-assisted summarization.

## Scope of Work

### Phase 1: Complete AI Service Implementation (Backend)
**Priority: Critical**

1. **Complete services.py implementation**
   - Implement real PDF ingestion using integrated_pdf_flow
   - Add OpenAI integration for AI responses
   - Create citation-aware AI assistant
   - Add proper error handling and logging

2. **Fix API response format**
   - Modify `/ingest-pdf` to return processing results immediately
   - Update `/assistant-message` to return formatted responses with citations
   - Add citation resolution endpoint

3. **Add missing dependencies**
   - Add OpenAI client to requirements.txt
   - Add environment variable configuration
   - Test AI service with real OpenAI API

### Phase 2: Frontend Integration Layer (Frontend)
**Priority: High**

1. **Create AI Service Client**
   - Build HTTP client for AI service communication
   - Add error handling and retry logic
   - Implement request/response typing

2. **Extend ContentCommunicationService**
   - Add AI service integration methods
   - Create PDF ingestion hooks
   - Add citation parsing utilities

3. **Update PDFReaderContentType**
   - Add automatic PDF text extraction and ingestion
   - Implement citation-to-coordinate mapping
   - Add bulk highlighting for AI citations

4. **Update AIAssistantContentType**
   - Add "Summarize PDF" button
   - Implement citation link rendering
   - Add PDF navigation integration

### Phase 3: Citation System Integration
**Priority: High**

1. **Citation Mapping System**
   - Convert AI citations to PDF coordinates
   - Create bidirectional mapping (coordinates ↔ citations)
   - Handle pagination and text reflow

2. **Highlight Synchronization**
   - Sync AI citations with PDF highlights
   - Add citation-specific highlight colors
   - Implement highlight metadata storage

3. **Navigation Integration**
   - Add click-to-navigate from AI citations
   - Implement smooth scrolling to citations
   - Add citation preview on hover

### Phase 4: Testing & Polish
**Priority: Medium**

1. **End-to-end testing**
   - Test PDF ingestion flow
   - Test AI summarization with citations
   - Test citation highlighting and navigation

2. **Performance optimization**
   - Optimize large PDF handling
   - Add caching for AI responses
   - Implement incremental processing

3. **Error handling**
   - Add graceful degradation
   - Implement retry mechanisms
   - Add user feedback for long operations

## Implementation Details

### Backend Tasks

1. **Complete services.py**
   ```python
   # Real implementation with OpenAI integration
   async def ingest_pdf(request: PDFIngestRequest) -> dict:
       # Use integrated_pdf_flow for processing
   
   async def process_assistant_message(request: AssistantMessageRequest) -> dict:
       # Real AI processing with citation support
   ```

2. **Add citation resolution endpoint**
   ```python
   @app.post("/resolve-citation")
   async def resolve_citation(pdf_id: str, citation: str) -> dict:
       # Convert citation to character offsets
   ```

3. **Update requirements.txt**
   ```
   fastapi
   uvicorn[standard]
   pydantic
   python-dotenv
   openai
   ```

### Frontend Tasks

1. **Create AIServiceClient**
   ```typescript
   class AIServiceClient {
       async ingestPDF(pdfId: string, textData: any): Promise<IngestResult>
       async summarizePDF(pdfId: string): Promise<SummaryResult>
       async resolveCitation(pdfId: string, citation: string): Promise<CitationLocation>
   }
   ```

2. **Extend ContentCommunicationService**
   ```typescript
   class ContentCommunicationService {
       async ingestPDFForAI(pdfId: string): Promise<void>
       async highlightCitations(citations: Citation[]): Promise<void>
       async navigateToCitation(citation: string): Promise<void>
   }
   ```

3. **Update PDFReaderContentType**
   ```typescript
   // Add to PDF load handler
   onPDFLoaded(textModel: TextModel) {
       this.communicationService.ingestPDFForAI(this.pdfId);
   }
   ```

4. **Update AIAssistantContentType**
   ```typescript
   // Add summarize button
   <button onClick={this.handleSummarize}>Summarize PDF</button>
   
   // Add citation link rendering
   renderCitationLinks(message: string): JSX.Element[]
   ```

## Acceptance Criteria

### Must Have
- [ ] PDF text automatically ingested when loaded
- [ ] AI summarization works with real OpenAI API
- [ ] Citations are clickable and navigate to PDF locations
- [ ] Citation highlighting works in PDF viewer
- [ ] Error handling for API failures

### Should Have
- [ ] Citation hover previews
- [ ] Bulk citation highlighting
- [ ] Search integration with citations
- [ ] Performance optimization for large PDFs
- [ ] Caching for AI responses

### Nice to Have
- [ ] Citation export functionality
- [ ] Advanced search with citation filtering
- [ ] Citation analytics and metrics
- [ ] Progressive enhancement for slow connections

## Timeline Estimate
- **Phase 1**: 2-3 days (Backend completion)
- **Phase 2**: 3-4 days (Frontend integration)
- **Phase 3**: 2-3 days (Citation system)
- **Phase 4**: 1-2 days (Testing & polish)

**Total**: 8-12 days

## Risk Assessment
- **High Risk**: OpenAI API integration complexity
- **Medium Risk**: Citation coordinate mapping accuracy
- **Low Risk**: Frontend integration (excellent existing architecture)

## Dependencies
- OpenAI API key and configuration
- Frontend build system compatibility
- AI service deployment environment

## Success Metrics
- PDF ingestion success rate > 95%
- Citation navigation accuracy > 98%
- AI response time < 10 seconds
- User satisfaction with citation highlighting
- No performance degradation in PDF viewer