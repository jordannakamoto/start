# AI Service - PDF Processing System

A FastAPI-based service for processing PDF documents with intelligent analysis and summarization capabilities. The system supports document classification, contract analysis, and structured summarization with clickable citations.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Core Components](#core-components)
- [Processing Flow](#processing-flow)
- [API Endpoints](#api-endpoints)
- [Document Types & Workflows](#document-types--workflows)
- [Extensibility](#extensibility)
- [Development](#development)

## Architecture Overview

The AI Service follows a clean, modular architecture with clear separation of concerns:

```
ai-service/
├── core/                      # Core processing logic
│   ├── pdf_service/           # PDF processing service
│   │   ├── service.py         # Main PDF service
│   │   ├── step_1_ingestion/  # PDF content extraction
│   │   └── step_2_classify/   # Document type classification
│   └── workflow_manager.py    # Workflow execution engine
├── flows/                     # Document-specific processing workflows
│   └── contracts/             # Contract processing workflows
│       ├── index.py           # Contract handler
│       └── summarize/         # Contract summarization workflow
│           ├── analysis/      # Deterministic analysis engine
│           ├── mapping/       # Navigation mapping
│           ├── interpretation/ # Strategic briefing
│           └── publishing/    # Final formatting
├── frontend_api/              # Frontend API endpoints
│   ├── search_api.py         # Search functionality for frontend
│   └── status_publisher.py   # Workflow status tracking
├── services/                  # Supporting services
│   ├── citation_service.py    # Citation handling
│   └── search_service.py      # PDF search capabilities
├── datastore/                 # Data storage
│   ├── document_datastore.py # Document persistence and retrieval
│   ├── search_datastore.py   # Search index and caching
│   └── documents/             # Document storage directory
├── utils/                     # Shared utilities
├── tests/                     # Test files
└── main.py                    # FastAPI server
```

## Getting Started

### Prerequisites
- Python 3.8+
- OpenAI API key (optional, system works without it)

### Installation
```bash
# Create virtual environment
python -m venv ai-service-env
source ai-service-env/bin/activate  # On Windows: ai-service-env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
echo "OPENAI_API_KEY=your_api_key_here" > .env
```

### Running the Service
```bash
# Start the FastAPI server
uvicorn main:app --reload --port 8000

# The service will be available at http://localhost:8000
# API documentation at http://localhost:8000/docs
```

## Core Components

### 1. PDF Service (`core/pdf_service/`)
**Purpose**: Main orchestrator for PDF processing

**Key Files**:
- `service.py` - Main PDFService class that handles all PDF operations
- `step_1_ingestion/processor.py` - PDF content extraction and storage
- `step_2_classify/processor.py` - Document type classification

**Flow**:
1. Ingest PDF pages and generate unique PDF ID
2. Classify document type (contract, research paper, etc.)
3. Route to appropriate document workflow

### 2. Workflow Manager (`core/workflow_manager.py`)
**Purpose**: Simple executor that runs workflow instructions from flow indexes

**Key Methods**:
- `execute_workflow()` - Executes step-by-step workflow instructions
- `execute_simple_workflow()` - Executes self-contained workflow functions

**Note**: Does not make routing decisions - just executes what flow indexes tell it to do.

### 3. Document Flows (`flows/`)
**Purpose**: Document-specific processing workflows

**Current Implementation**: Contract processing in `flows/contracts/`
- `index.py` - Main contract handler that routes to different contract workflows
- `summarize/` - 4-step contract summarization workflow

### 4. Frontend Interface (`frontend_interface/`)
**Purpose**: API endpoints specifically for frontend applications

**Key Files**:
- `search_api.py` - Search functionality, PDF indexing, and query capabilities

### 5. Supporting Services (`services/`)
**Purpose**: Shared services used across the system

**Key Files**:
- `citation_service.py` - Handles citation extraction, validation, and resolution
- `search_service.py` - PDF search and retrieval capabilities

## Processing Flow

### High-Level Flow
```
PDF Upload → PDF Service → Classification → Document-Specific Workflow → Response
```

### Detailed Flow
1. **PDF Ingestion** (`POST /ingest-pdf`)
   - Receives PDF pages from frontend
   - Generates unique PDF ID
   - Stores content for processing
   - Returns job ID

2. **Document Processing** (`POST /assistant-message`)
   - Retrieves PDF data using PDF ID
   - Classifies document type
   - Routes to appropriate workflow (currently defaults to contract)
   - Returns structured response with citations

3. **Citation Resolution** (`POST /resolve-citation`)
   - Resolves citation references to specific PDF content
   - Returns citation details and location

### Contract Processing Workflow
For contract documents, the system uses a 4-step process:

1. **Analysis** (`flows/contracts/summarize/analysis/`)
   - Uses deterministic analysis engine
   - Extracts structured claims, entities, and relationships
   - Identifies obligations, permissions, prohibitions, and definitions

2. **Mapping** (`flows/contracts/summarize/mapping/`)
   - Creates navigation summary
   - Builds document structure map

3. **Interpretation** (`flows/contracts/summarize/interpretation/`)
   - Applies strategic briefing tone
   - Converts technical language to executive summary format

4. **Publishing** (`flows/contracts/summarize/publishing/`)
   - Formats final output
   - Creates clickable citations
   - Structures response for frontend

## API Endpoints

### Main Endpoints (defined in `main.py`)

#### `POST /ingest-pdf`
Receives PDF pages and processes them through the AI pipeline.

**Request Body**:
```json
{
  "pages": {
    "1": "Page 1 content...",
    "2": "Page 2 content..."
  }
}
```

**Response**:
```json
{
  "job_id": "pdf_abc123",
  "status": "ingested",
  "message": "PDF ingested successfully. Use /assistant-message to process."
}
```

#### `POST /assistant-message`
Processes user messages and triggers PDF summarization.

**Request Body**:
```json
{
  "user_id": "user123",
  "message": "summarize"
}
```

**Response**:
```json
{
  "response": "## Contract Summary\n- **Party A** must provide services [CITATION_01]\n- **Party B** shall pay within 30 days [CITATION_02]",
  "citations": [
    {
      "id": "CITATION_01",
      "content": "The Service Provider agrees to...",
      "page": 1,
      "reference": "Section 2.1"
    }
  ],
  "has_citations": true
}
```

#### `POST /resolve-citation`
Resolves citation references to their source content.

**Request Body**:
```
pdf_id=pdf_abc123&citation=CITATION_01
```

### Search Endpoints (defined in `frontend_api/search_api.py`)

#### `POST /api/search/query`
Search within PDF content.

#### `GET /api/search/navigation/{pdf_id}`
Get PDF navigation structure.

#### `POST /api/search/index`
Create or update search index for a PDF.

### Status Endpoints (defined in `frontend_api/status_publisher.py`)

#### `GET /api/status/workflow/{workflow_id}`
Get current status of a workflow.

**Response**:
```json
{
  "workflow_id": "pdf_abc123",
  "current_step": "contract_interpretation",
  "overall_status": "in_progress",
  "progress_percent": 65,
  "steps": {
    "contract_analysis": {
      "status": "completed",
      "message": "Contract analysis completed",
      "progress_percent": 25
    },
    "contract_mapping": {
      "status": "completed", 
      "message": "Navigation mapping completed",
      "progress_percent": 50
    },
    "contract_interpretation": {
      "status": "in_progress",
      "message": "Converting to strategic briefing format",
      "progress_percent": 65
    }
  }
}
```

#### `GET /api/status/workflow/{workflow_id}/history`
Get complete status history for a workflow.

#### `GET /api/status/active`
Get all currently active workflows.

### Datastore Management Endpoints

#### `GET /api/status/datastore/stats`
Get document datastore statistics.

**Response**:
```json
{
  "total_documents": 15,
  "status_counts": {
    "ingested": 5,
    "classified": 8,
    "completed": 2
  },
  "type_counts": {
    "contract": 12,
    "research_paper": 3
  },
  "storage_path": "datastore/documents"
}
```

#### `GET /api/status/datastore/documents`
List documents in datastore with optional filtering.

**Query Parameters**:
- `status`: Filter by document status (ingested, classified, completed, etc.)
- `document_type`: Filter by document type (contract, research_paper, etc.)
- `limit`: Maximum number of results (default: 100)

#### `POST /api/status/datastore/cleanup`
Clean up old documents from datastore.

**Query Parameters**:
- `max_age_days`: Maximum age in days (default: 30)

## Data Storage

The system uses a file-based datastore for document persistence:

### **📁 Storage Structure:**
```
datastore/
├── document_datastore.py         # Document persistence logic
├── search_datastore.py          # Search functionality
└── documents/                    # Document storage
    ├── document_index.json       # Fast lookup index
    ├── pdf_abc123.json          # Individual document files
    └── pdf_def456.json
```

### **Document Lifecycle:**
1. **Ingestion**: PDF pages stored with `INGESTED` status
2. **Classification**: Document type determined, status updated to `CLASSIFIED`
3. **Processing**: Contract workflow runs, status becomes `PROCESSING`
4. **Completion**: Final results stored, status becomes `COMPLETED`

### **Storage Features:**
- **Persistent**: Documents survive server restarts
- **Indexed**: Fast lookups via document index
- **Versioned**: Full processing history tracked
- **Self-cleaning**: Automatic cleanup of old documents
- **Extensible**: Easy to migrate to database later

## Document Types & Workflows

### Current Support
- **Contracts**: Full 4-step workflow with deterministic analysis
- **Other Document Types**: Fall back to contract workflow

### Contract Workflow Details

#### Deterministic Analysis Engine
Located in `flows/contracts/summarize/analysis/deterministic_analysis.py`

**Features**:
- Rule-based pattern matching for legal content
- Extracts obligations, permissions, prohibitions, definitions
- Builds structured knowledge graph
- Provides deterministic confidence scores

**Pattern Types**:
- Obligation patterns: "must", "shall", "required to"
- Prohibition patterns: "shall not", "may not", "prohibited"
- Permission patterns: "may", "can", "allowed to"
- Definition patterns: "means", "refers to", "is defined as"
- Conditional patterns: "if", "when", "provided that"
- Temporal patterns: "within", "before", "after"

#### Strategic Briefing
The interpretation step converts technical contract language into executive-friendly summaries:
- Clear, direct bullet points
- Strategic implications highlighted
- Key obligations and rights emphasized
- Timeline and compliance requirements surfaced

## Extensibility

### Adding New Document Types

1. **Create Document Flow**
   ```bash
   mkdir -p flows/research_papers
   touch flows/research_papers/__init__.py
   touch flows/research_papers/index.py
   ```

2. **Implement Document Index**
   ```python
   # flows/research_papers/index.py
   class ResearchPaperIndex:
       def __init__(self, openai_client=None):
           self.openai_client = openai_client
           self.workflows = {
               "summarize": ResearchPaperSummarizeWorkflow(openai_client),
               "analyze": ResearchPaperAnalyzeWorkflow(openai_client),
           }
       
       async def process_document(self, pdf_data, workflow_type="summarize"):
           # Implementation here
           pass
   ```

3. **Register in PDF Service**
   ```python
   # core/pdf_service/service.py
   from flows.research_papers.index import ResearchPaperIndex
   
   self.document_handlers = {
       "contract": ContractIndex(openai_client),
       "research_paper": ResearchPaperIndex(openai_client),  # Add this
   }
   ```

4. **Update Classification**
   ```python
   # core/pdf_service/step_2_classify/processor.py
   # Add logic to detect research papers
   ```

### Adding New Workflows to Existing Document Types

1. **Create Workflow Directory**
   ```bash
   mkdir -p flows/contracts/analyze
   touch flows/contracts/analyze/__init__.py
   touch flows/contracts/analyze/contract_workflow.py
   ```

2. **Implement Workflow**
   ```python
   # flows/contracts/analyze/contract_workflow.py
   class ContractAnalyzeWorkflow:
       async def process_contract(self, pdf_data):
           # Implementation here
           pass
   ```

3. **Register in Contract Index**
   ```python
   # flows/contracts/index.py
   from flows.contracts.analyze.contract_workflow import ContractAnalyzeWorkflow
   
   self.workflows = {
       "summarize": ContractWorkflow(openai_client),
       "analyze": ContractAnalyzeWorkflow(openai_client),  # Add this
   }
   ```

### Adding New Processing Steps

1. **Create Step Directory**
   ```bash
   mkdir -p flows/contracts/summarize/validation
   touch flows/contracts/summarize/validation/__init__.py
   touch flows/contracts/summarize/validation/processor.py
   ```

2. **Implement Step Processor**
   ```python
   # flows/contracts/summarize/validation/processor.py
   class ValidationStep:
       async def process(self, data):
           # Implementation here
           pass
   ```

3. **Integrate into Workflow**
   ```python
   # flows/contracts/summarize/contract_workflow.py
   from flows.contracts.summarize.validation.processor import ValidationStep
   
   self.validation_step = ValidationStep()
   
   async def process_contract(self, pdf_data):
       # Add validation step to workflow
       validation_result = await self.validation_step.process(interpretation_result)
   ```

### Adding New API Endpoints

1. **Create New Router**
   ```python
   # frontend_interface/new_api.py
   from fastapi import APIRouter
   
   router = APIRouter(prefix="/api/new", tags=["new"])
   
   @router.post("/endpoint")
   async def new_endpoint():
       pass
   ```

2. **Register in Main**
   ```python
   # main.py
   from frontend_interface.new_api import router as new_router
   app.include_router(new_router)
   ```

### Extending the Deterministic Analysis Engine

1. **Add New Pattern Types**
   ```python
   # flows/contracts/summarize/analysis/deterministic_analysis.py
   class ContentPattern(Enum):
       EXISTING_PATTERNS = "existing"
       NEW_PATTERN = "new_pattern"  # Add this
   
   # Add new pattern compilation
   self.new_patterns = [
       r'your_regex_pattern_here',
   ]
   ```

2. **Add Pattern Processing**
   ```python
   def _extract_new_pattern_claim(self, pattern, sentence, citation, claim_id):
       # Implementation here
       pass
   ```

### Custom Workflow Managers

For complex workflows, you can create custom workflow managers:

```python
# core/custom_workflow_manager.py
class CustomWorkflowManager:
    async def execute_parallel_workflow(self, instructions):
        # Execute multiple workflows in parallel
        pass
    
    async def execute_conditional_workflow(self, instructions):
        # Execute workflows based on conditions
        pass
```

## Development

### Running Tests
```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_pdf_summary.py
```

### Code Style
- Use type hints for all function parameters and return values
- Follow PEP 8 style guidelines
- Add docstrings to all classes and methods
- Use async/await for I/O operations

### Adding Dependencies
```bash
# Add new dependency
pip install new-package

# Update requirements
pip freeze > requirements.txt
```

### Environment Variables
- `OPENAI_API_KEY`: OpenAI API key for LLM functionality (optional)
- Add new environment variables to `.env` file

### Logging
The system uses structured logging throughout:
```python
from utils.logging import setup_logger
logger = setup_logger(__name__)

logger.info("Processing started")
logger.error("Error occurred", exc_info=True)
```

### Error Handling
- All async functions should handle exceptions gracefully
- Return structured error responses with appropriate HTTP status codes
- Log errors with context for debugging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the architecture patterns
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

## License

[Add your license information here]