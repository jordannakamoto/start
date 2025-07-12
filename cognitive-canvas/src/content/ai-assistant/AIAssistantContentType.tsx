// AI Assistant content type - chat interface with AI
// This version assumes you have initialized shadcn/ui and added the required components.

// --- Import actual shadcn/ui components ---
// The path "@/components/ui/..." is the default from shadcn/ui setup.
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentEditorProps, ContentTypeDefinition } from '../types';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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


  const addMessage = useCallback((role: 'user' | 'assistant', messageContent: string) => {
    const newMessage: Message = { id: `msg_${Date.now()}`, role, content: messageContent, timestamp: Date.now() };
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

  return (
    <Card className="h-full flex flex-col w-full !rounded-none !border-0">
      <CardHeader className="flex flex-row items-center border-b">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-sm font-medium leading-none">AI Assistant</p>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
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
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <BotIcon className="w-4 h-4 text-foreground" />
                </div>
              )}
               <div className={`group flex flex-col gap-1 max-w-[85%] ${message.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`px-4 py-2.5 rounded-lg text-sm ${ message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
               </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
        ))}

         {chatState.isTyping && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <BotIcon className="w-4 h-4 text-foreground" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3.5">
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-bounce [animation-delay:0.3s]"></div>
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