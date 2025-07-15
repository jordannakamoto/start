// AI Assistant content type - chat interface with AI
// This version assumes you have initialized shadcn/ui and added the required components.

// --- Import actual shadcn/ui components ---
// The path "@/components/ui/..." is the default from shadcn/ui setup.
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentEditorProps, ContentTypeDefinition } from '../types';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { pdfHighlight, aiService } from '../../services/ContentCommunicationService';
import { CitationParser } from '../../services/AIServiceClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Reusable Icon Components for a cleaner look ---
const BotIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
  </svg>
);

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const SendIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>
    </svg>
);


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: string[];
  hasCitations?: boolean;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
}

function parseStateFromContent(content: string): ChatState {
  try {
    if (!content) {
      return { messages: [], isTyping: false };
    }
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.messages)) {
      return { 
        messages: parsed.messages, 
        isTyping: parsed.isTyping || false 
      };
    }
  } catch (error) {
    console.warn('Failed to parse chat state:', error);
  }
  return { messages: [], isTyping: false };
}

function serializeStateToContent(state: ChatState): string {
  return JSON.stringify({
    messages: state.messages,
    isTyping: state.isTyping
  });
}


function AIAssistantEditor({ documentId, content, onContentChange }: ContentEditorProps) {
  const [chatState, setChatState] = useState<ChatState>(() => parseStateFromContent(content));
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  useEffect(() => {
    const serialized = serializeStateToContent(chatState);
    if (serialized !== content) {
      onContentChange(serialized);
    }
  }, [chatState, onContentChange, content]);
  
  // The Textarea component from shadcn doesn't auto-resize by default,
  // so we can use a library like 'react-textarea-autosize' or keep this simple manual hook.
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [inputValue]);


  const addMessage = useCallback((role: 'user' | 'assistant', messageContent: string, citations?: string[]) => {
    const newMessage: Message = { 
      id: `msg_${Date.now()}`, 
      role, 
      content: messageContent, 
      timestamp: Date.now(),
      citations,
      hasCitations: citations && citations.length > 0
    };
    setChatState(prev => ({ ...prev, messages: [...prev.messages, newMessage] }));
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;
    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);
    setChatState(prev => ({ ...prev, isTyping: true }));

    setTimeout(() => {
      const responses = ["This is a placeholder response.", "I'm a frontend-only demo for now.", `I received: "${userMessage}"`];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setChatState(prev => ({ ...prev, isTyping: false }));
      addMessage('assistant', randomResponse);
    }, 1500);
  }, [addMessage, inputValue]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle citation click - navigate to citation in PDF
  const handleCitationClick = useCallback(async (citation: string) => {
    try {
      const documents = pdfHighlight.getDocuments();
      if (documents.length === 0) {
        addMessage('assistant', 'No PDF documents are currently open to navigate to.');
        return;
      }

      const document = documents[0]; // Use first available document
      const result = await aiService.navigateToCitation(document.documentId, citation);
      
      if (result?.payload.success) {
        addMessage('assistant', `✅ Navigated to citation ${citation} in the PDF.`);
      } else {
        addMessage('assistant', `❌ Could not navigate to citation ${citation}: ${result?.payload.error || 'Unknown error'}`);
      }
    } catch (error) {
      addMessage('assistant', `❌ Error navigating to citation: ${error}`);
    }
  }, [addMessage]);

  // Summarize PDF functionality
  const handleSummarizePDF = useCallback(async () => {
    try {
      const documents = pdfHighlight.getDocuments();
      if (documents.length === 0) {
        addMessage('assistant', 'No PDF documents are currently open. Please open a PDF document first.');
        return;
      }

      const document = documents.find(doc => doc.hasContent);
      if (!document) {
        addMessage('assistant', 'Found PDF documents but they have no text content loaded yet.');
        return;
      }

      addMessage('user', 'Summarize this PDF');
      setChatState(prev => ({ ...prev, isTyping: true }));

      try {
        const summary = await aiService.summarizePDF(document.documentId);
        
        if (summary.has_citations) {
          // Extract citations from response
          const citations = CitationParser.extractCitations(summary.response);
          
          // Add AI summary with citations
          setChatState(prev => ({ ...prev, isTyping: false }));
          addMessage('assistant', summary.response, citations);
          
          // Highlight citations in PDF
          if (citations.length > 0) {
            await aiService.highlightCitations(document.documentId, citations);
          }
        } else {
          setChatState(prev => ({ ...prev, isTyping: false }));
          addMessage('assistant', summary.response);
        }
      } catch (error) {
        setChatState(prev => ({ ...prev, isTyping: false }));
        addMessage('assistant', `❌ Error summarizing PDF: ${error}`);
      }
    } catch (error) {
      setChatState(prev => ({ ...prev, isTyping: false }));
      addMessage('assistant', `❌ Error accessing PDF: ${error}`);
    }
  }, [addMessage]);

  // Test function to demonstrate highlight API
  const testHighlightAPI = useCallback(async () => {
    try {
      const result = await pdfHighlight.test();
      
      if (result.success) {
        const highlightInfo = `
🎉 Highlight API Test Successful!

${result.message}

📄 Available PDF Documents: ${result.availableDocuments.length}
${result.availableDocuments.map(doc => 
  `• ${doc.documentId}: ${doc.hasContent ? '✅ Has content' : '❌ No content'} (${doc.stats.totalHighlights} highlights)`
).join('\n')}

${result.demonstrationResults ? `
🖍️ Test Results:
• ${result.demonstrationResults.data?.message || 'Test completed'}
• Highlighted text: "${result.demonstrationResults.data?.highlightedText || 'N/A'}"
• Position: ${result.demonstrationResults.data?.position || 'N/A'}
• Highlight ID: ${result.demonstrationResults.data?.highlightId || 'N/A'}
• Total highlights: ${result.demonstrationResults.data?.stats?.totalHighlights || 0}
• Colors used: ${Object.keys(result.demonstrationResults.data?.stats?.highlightsByColor || {}).length}

💡 You should now see a yellow highlight on the PDF document!
Check the browser console for debug logs.
` : ''}

📚 API Usage Examples:
\`\`\`javascript
// Test the system
await pdfHighlight.test();

// Add highlight to document
await pdfHighlight.add('doc123', 10, 50, { 
  color: '#FFFF0080', 
  note: 'Important section!' 
});

// Find and highlight text
await pdfHighlight.findAndHighlight('doc123', /pattern/gi, {
  color: '#00FF0080'
});

// Export all highlights
const exported = await pdfHighlight.export('doc123');

// Get available documents
const docs = pdfHighlight.getDocuments();
\`\`\`

✅ System is ready for external service integration!
        `;
        
        addMessage('assistant', highlightInfo);
      } else {
        addMessage('assistant', `
❌ Highlight API Test Failed

${result.message}

📄 Available PDF Documents: ${result.availableDocuments.length}
${result.availableDocuments.map(doc => 
  `• ${doc.documentId}: ${doc.hasContent ? '✅ Has content' : '❌ No content'}`
).join('\n')}

💡 To test the highlight system:
1. Open a PDF document in another tab
2. Wait for it to load completely
3. Try the test button again

The highlight API is ready, but needs an active PDF document to demonstrate on.
        `);
      }
      
    } catch (error) {
      addMessage('assistant', `❌ Error testing highlight API: ${error}\n\nThe communication service may not be properly initialized.`);
    }
  }, [addMessage]);

  // Render message content with clickable citations
  const renderMessageContent = useCallback((message: Message) => {
    if (message.role === 'user') {
      // User messages - simple text rendering
      return <p className="whitespace-pre-wrap">{message.content}</p>;
    }

    // Assistant messages - process citations and render as markdown
    if (!message.hasCitations) {
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom styling for markdown elements
              p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
              ul: ({children}) => <ul className="list-disc pl-6 mb-3">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal pl-6 mb-3">{children}</ol>,
              li: ({children}) => <li className="mb-1">{children}</li>,
              code: ({children, ...props}) => {
                const inline = !('className' in props);
                return inline ? 
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code> :
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3"><code className="text-sm font-mono">{children}</code></pre>;
              },
              blockquote: ({children}) => <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic">{children}</blockquote>,
              h1: ({children}) => <h1 className="text-xl font-bold mb-3">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-semibold mb-2">{children}</h3>,
              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
              em: ({children}) => <em className="italic">{children}</em>,
              hr: () => <hr className="my-4 border-muted-foreground/20" />,
              table: ({children}) => <table className="w-full border-collapse mb-3">{children}</table>,
              th: ({children}) => <th className="border border-muted-foreground/20 px-3 py-2 text-left font-semibold">{children}</th>,
              td: ({children}) => <td className="border border-muted-foreground/20 px-3 py-2">{children}</td>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      );
    }

    // Process content with citations
    const parts = CitationParser.replaceCitationsWithCallback(
      message.content,
      handleCitationClick
    );

    // Convert parts array into markdown-compatible content
    const processedContent = parts.map((part, index) => {
      if (typeof part === 'string') {
        return part;
      } else {
        // Return a placeholder that we'll replace in the markdown renderer
        return `__CITATION_${index}__`;
      }
    }).join('');

    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
          // Custom styling for markdown elements
          p: ({children}) => {
            // Process children to replace citation placeholders
            const processChildren = (child: any): any => {
              if (typeof child === 'string') {
                // Check if this string contains citation placeholders
                const citationRegex = /__CITATION_(\d+)__/g;
                const matches = [...child.matchAll(citationRegex)];
                
                if (matches.length === 0) return child;
                
                const result = [];
                let lastIndex = 0;
                
                matches.forEach((match) => {
                  const [fullMatch, indexStr] = match;
                  const citationIndex = parseInt(indexStr);
                  const part = parts[citationIndex];
                  
                  // Add text before citation
                  if (match.index > lastIndex) {
                    result.push(child.substring(lastIndex, match.index));
                  }
                  
                  // Add citation button
                  if (typeof part !== 'string') {
                    result.push(
                      <button
                        key={`citation-${citationIndex}`}
                        onClick={part.onClick}
                        className="text-blue-600 hover:text-blue-800 underline bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded text-sm transition-colors mx-0.5"
                        title={`Navigate to ${part.citation}`}
                      >
                        {part.citation}
                      </button>
                    );
                  }
                  
                  lastIndex = match.index + fullMatch.length;
                });
                
                // Add remaining text
                if (lastIndex < child.length) {
                  result.push(child.substring(lastIndex));
                }
                
                return result;
              }
              return child;
            };
            
            const processedChildren = Array.isArray(children) 
              ? children.map(processChildren).flat()
              : processChildren(children);
            
            return <p className="mb-3 last:mb-0">{processedChildren}</p>;
          },
          ul: ({children}) => <ul className="list-disc pl-6 mb-3">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal pl-6 mb-3">{children}</ol>,
          li: ({children}) => <li className="mb-1">{children}</li>,
          code: ({children, ...props}) => {
            const inline = !('className' in props);
            return inline ? 
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code> :
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3"><code className="text-sm font-mono">{children}</code></pre>;
          },
          blockquote: ({children}) => <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic">{children}</blockquote>,
          h1: ({children}) => <h1 className="text-xl font-bold mb-3">{children}</h1>,
          h2: ({children}) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-base font-semibold mb-2">{children}</h3>,
          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
          em: ({children}) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-4 border-muted-foreground/20" />,
          table: ({children}) => <table className="w-full border-collapse mb-3">{children}</table>,
          th: ({children}) => <th className="border border-muted-foreground/20 px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({children}) => <td className="border border-muted-foreground/20 px-3 py-2">{children}</td>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
      </div>
    );
  }, [handleCitationClick]);

  return (
    <Card className="h-full flex flex-col w-full !rounded-none !border-0">
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-sm font-medium leading-none">AI Assistant</p>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {/* Summarize PDF button */}
          <Button
            onClick={handleSummarizePDF}
            variant="default"
            size="sm"
            className="text-xs"
            disabled={chatState.isTyping}
          >
            📄 Summarize PDF
          </Button>
          
          {/* Test highlight button */}
          <Button
            onClick={testHighlightAPI}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            🖍️ Test Highlight API
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {chatState.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <h2 className="text-xl font-semibold">AI Assistant</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Ask me anything! I can help you brainstorm ideas, write content, or debug code.
            </p>
          </div>
        )}
        
        {chatState.messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <BotIcon className="w-4 h-4 text-foreground" />
                </div>
              )}
               <div className={`group flex flex-col gap-1 ${message.role === 'user' ? 'max-w-[85%] items-end' : 'flex-1 min-w-0'}`}>
                  <div className={`text-sm ${ 
                    message.role === 'user' 
                      ? 'px-4 py-2.5 rounded-lg bg-primary text-primary-foreground' 
                      : 'text-foreground'
                  }`}>
                    {renderMessageContent(message)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
               </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
        ))}

         {chatState.isTyping && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <BotIcon className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1">
                <div className="inline-flex space-x-1.5">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.3s]"></div>
                </div>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </CardContent>

      <CardFooter className="p-4 border-t">
         <div className="relative w-full">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Send a message..."
              className="pr-14 max-h-48"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || chatState.isTyping}
            >
              <SendIcon className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
      </CardFooter>
    </Card>
  );
}


export const aiAssistantContentType: ContentTypeDefinition = {
  metadata: {
    type: 'ai-assistant',
    displayName: 'AI Assistant',
    description: 'Chat with an AI assistant',
    icon: '🤖'
  },

  renderEditor: (props: ContentEditorProps) => <AIAssistantEditor {...props} />,

  validateContent: (content: string) => {
    try {
      if (!content) return true;
      const parsed = JSON.parse(content);
      return parsed && Array.isArray(parsed.messages);
    } catch {
      return false;
    }
  },

  getDefaultContent: () => JSON.stringify({ messages: [], isTyping: false }),

  importFrom: (content: string) => content,
  
  exportTo: (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.messages || !Array.isArray(parsed.messages)) return content;
      return parsed.messages
        .map((msg: Message) => `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`)
        .join('\n\n');
    } catch {
      return content;
    }
  }
};