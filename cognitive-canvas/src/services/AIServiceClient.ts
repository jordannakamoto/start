/**
 * AI Service Client for PDF processing and citation management
 */

export interface PDFIngestRequest {
  pages: Record<number, string>;
}

export interface PDFIngestResult {
  job_id: string;
  status: 'completed' | 'failed';
  processing_result?: any;
  total_pages?: number;
  citations_extracted?: number;
  error?: string;
}

export interface AssistantMessageRequest {
  user_id: string;
  message: string;
}

export interface AssistantMessageResponse {
  response: string;
  citations: string[];
  has_citations: boolean;
  pdf_id?: string;
  error?: string;
}

export interface CitationResolution {
  citation: string;
  found: boolean;
  content?: string;
  page?: number;
  paragraph?: number;
  sentence?: number;
  char_range?: [number, number];
  context?: any;
  error?: string;
}

export interface SearchRequest {
  pdf_id: string;
  query: string;
  search_type?: 'exact' | 'semantic' | 'proximity' | 'entity' | 'hybrid';
  page_filter?: number;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  reference: string;
  page: number;
  paragraph: number;
  sentence: number;
  char_range: [number, number];
  keywords: string[];
  entities: any[];
  highlight_positions: number[][];
}

export interface SearchResponse {
  results: SearchResult[];
  total_count: number;
  search_id: string;
  execution_time_ms: number;
}

export class AIServiceClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:8000', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Ingest PDF pages into the AI service for processing
   */
  async ingestPDF(pages: Record<number, string>): Promise<PDFIngestResult> {
    const response = await this.makeRequest<PDFIngestResult>('/ingest-pdf', {
      method: 'POST',
      body: JSON.stringify({ pages }),
    });
    
    return response;
  }

  /**
   * Send message to AI assistant
   */
  async sendMessage(userId: string, message: string): Promise<AssistantMessageResponse> {
    const response = await this.makeRequest<AssistantMessageResponse>('/assistant-message', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message }),
    });
    
    return response;
  }

  /**
   * Summarize PDF with citations
   */
  async summarizePDF(pdfId: string, userId: string = 'user'): Promise<AssistantMessageResponse> {
    return this.sendMessage(userId, `summarize_pdf:${pdfId}`);
  }

  /**
   * Resolve citation to location and content
   */
  async resolveCitation(pdfId: string, citation: string): Promise<CitationResolution> {
    const response = await this.makeRequest<CitationResolution>('/resolve-citation', {
      method: 'POST',
      body: new URLSearchParams({ pdf_id: pdfId, citation }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    return response;
  }

  /**
   * Search PDF content
   */
  async searchPDF(request: SearchRequest): Promise<SearchResponse> {
    const response = await this.makeRequest<SearchResponse>('/api/search/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    return response;
  }

  /**
   * Create search index for PDF
   */
  async createSearchIndex(pdfId: string, segments: any[]): Promise<any> {
    const response = await this.makeRequest('/api/search/index', {
      method: 'POST',
      body: JSON.stringify({ pdf_id: pdfId, segments }),
    });
    
    return response;
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(pdfId: string, partial: string): Promise<{ suggestions: string[] }> {
    const url = `/api/search/suggestions?pdf_id=${encodeURIComponent(pdfId)}&partial=${encodeURIComponent(partial)}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Get navigation map for PDF
   */
  async getNavigationMap(pdfId: string, page?: number): Promise<any> {
    const url = `/api/search/navigation/${encodeURIComponent(pdfId)}${page ? `?page=${page}` : ''}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  /**
   * Generic request method with error handling and timeouts
   */
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      
      throw error;
    }
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Citation parsing utilities
 */
export class CitationParser {
  private static readonly CITATION_REGEX = /\[p(\d+)\.para(\d+)\.s(\d+)\]/g;

  /**
   * Parse citation string to structured format
   */
  static parseCitation(citation: string): {
    page: number;
    paragraph: number;
    sentence: number;
    reference: string;
  } | null {
    const match = citation.match(/p(\d+)\.para(\d+)\.s(\d+)/);
    if (!match) return null;

    return {
      page: parseInt(match[1], 10),
      paragraph: parseInt(match[2], 10),
      sentence: parseInt(match[3], 10),
      reference: citation,
    };
  }

  /**
   * Extract all citations from text
   */
  static extractCitations(text: string): string[] {
    const matches = text.matchAll(this.CITATION_REGEX);
    return Array.from(matches).map(match => match[0]);
  }

  /**
   * Replace citations in text with clickable elements
   */
  static replaceCitationsWithCallback(
    text: string,
    onCitationClick: (citation: string) => void
  ): (string | { type: 'citation'; citation: string; onClick: () => void })[] {
    const parts: (string | { type: 'citation'; citation: string; onClick: () => void })[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(this.CITATION_REGEX)) {
      // Add text before citation
      if (match.index! > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add citation object
      parts.push({
        type: 'citation',
        citation: match[0],
        onClick: () => onCitationClick(match[0]),
      });

      lastIndex = match.index! + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }
}

// Singleton instance
export const aiServiceClient = new AIServiceClient();