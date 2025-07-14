# AI Service Documentation

## Overview

The AI Service is a FastAPI-based backend that provides intelligent PDF processing, search, and summarization capabilities. It uses the PocketFlow framework for orchestrating complex data processing workflows.

## Architecture

### Core Components

1. **PocketFlow Framework** (`pocketflow.py`)
   - Base workflow orchestration system
   - Supports synchronous and asynchronous node execution
   - Provides Flow, BatchFlow, and ParallelFlow patterns
   - Enables conditional transitions between nodes

2. **FastAPI Application** (`main.py`)
   - REST API endpoints for PDF ingestion and AI assistant
   - Integrated search API router
   - Handles PDF processing requests

3. **Data Models** (`models.py`)
   - `PDFIngestRequest`: PDF pages data structure
   - `AssistantMessageRequest`: Chat interface model

4. **Services** (`services.py`)
   - Core business logic for PDF ingestion
   - AI assistant message processing

### PDF Processing Pipeline

#### 1. PDF Summary Generation (`test_pdf_summary.py`)
```
PDFParseNode → CitationExtractionNode → KeyPointsExtractionNode → SummaryGenerationNode
```

- **PDFParseNode**: Splits PDF pages into paragraphs
- **CitationExtractionNode**: Creates precise references (p{page}.para{paragraph}.s{sentence})
- **KeyPointsExtractionNode**: Identifies important sentences using keyword matching
- **SummaryGenerationNode**: Generates formatted summary with citations

#### 2. Search Infrastructure

##### Data Store (`search_datastore.py`)
- **TextSegment**: Atomic unit of searchable content
  - Precise location tracking (page, paragraph, sentence, character range)
  - Keywords and entities
  - Embeddings support (for future semantic search)
  
- **SemanticIndex**: Multi-faceted search index
  - Inverted index for word lookup
  - Position index for navigation
  - Entity index for typed searches
  - Proximity graph for context

- **PDFSearchCache**: Per-PDF cache with metrics
  - Search history tracking
  - Access patterns
  - Optimization metrics

- **SearchDataStore**: Global search management
  - Multiple PDF cache management
  - Search analytics
  - Query suggestions

##### Search API (`search_api.py`)
Endpoints:
- `POST /api/search/index`: Create/update search index
- `POST /api/search/query`: Execute searches
  - Search types: exact, semantic, proximity, entity, hybrid
  - Pagination support
  - Highlight position calculation
- `GET /api/search/suggestions`: Auto-complete
- `GET /api/search/navigation/{pdf_id}`: Hierarchical navigation
- `GET /api/search/cache/stats/{pdf_id}`: Performance metrics
- `POST /api/search/batch-search`: Multiple queries

##### Background Processing (`background_processors.py`)
- **KeywordExtractionNode**: TF-IDF keyword extraction
- **EntityRecognitionNode**: Pattern-based entity detection
- **ProximityGraphBuilderNode**: Segment relationship mapping
- **SearchPatternAnalyzerNode**: Query pattern analysis
- **IndexOptimizationFlow**: Periodic optimization tasks

#### 3. Integration Flow (`integrated_pdf_flow.py`)
Combines PDF processing with search indexing in a single flow:
```
PDF Input → Parse → Extract Citations → Generate Keywords/Entities → Create Search Index → Build Proximity Graph
```

## Data Flow

1. **PDF Ingestion**:
   ```
   Frontend → POST /ingest-pdf → Parse PDF → Extract Citations → Index for Search → Return Job ID
   ```

2. **Search Query**:
   ```
   Frontend → POST /api/search/query → Deterministic Search → Enrich Results → Return with Citations
   ```

3. **AI Assistant**:
   ```
   Frontend → POST /assistant-message → Process Message → Search Relevant Content → Generate Response
   ```

## Key Features

1. **Deterministic Search**: Consistent results through hashing and ordered processing
2. **Citation Tracking**: Every piece of content has a precise reference
3. **Multi-Modal Search**: Exact, proximity, entity, and hybrid search modes
4. **Background Optimization**: Continuous improvement of search quality
5. **Scalable Architecture**: Async processing with proper flow orchestration

## Usage Example

```python
# Process a PDF and create searchable index
from integrated_pdf_flow import process_pdf_with_search

pdf_data = {
    1: "First page content...",
    2: "Second page content..."
}

result = await process_pdf_with_search(pdf_data, "unique_pdf_id")

# Search the processed PDF
from integrated_pdf_flow import search_processed_pdf

search_results = await search_processed_pdf("unique_pdf_id", "search query", "hybrid")
```

## Testing

- `test_pdf_summary.py`: Test PDF parsing and summary generation
- `test_search_system.py`: Test search functionality without FastAPI dependencies

## Dependencies

- FastAPI: Web framework
- Pydantic: Data validation
- Python 3.7+: Async support
- No external NLP libraries (uses pattern matching for entity recognition)