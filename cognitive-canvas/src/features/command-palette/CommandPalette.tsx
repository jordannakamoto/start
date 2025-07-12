/**
 * Command Palette - The Application's Primary Interface
 * 
 * This is not just a search box - it's the canonical way to perform any action.
 * The UI is visual confirmation of commands executed through the palette.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Command, ArrowUp, ArrowDown, CornerDownLeft, File, Edit, View, Box, Code, HelpCircle, Bug } from 'lucide-react';
import { getCommandRegistry, CommandSearchResult, CommandChainState } from '../../core/command/CommandRegistry';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to get Lucide icon component by name
const CommandIcon: React.FC<{ icon?: string }> = ({ icon }) => {
  if (!icon) return null;

  // A simple mapping to start. This can be expanded.
  const iconMap: { [key: string]: React.ElementType } = {
    file: File,
    edit: Edit,
    view: View,
    document: Box,
    format: Code,
    tools: Code,
    help: HelpCircle,
    debug: Bug,
    search: Search,
    command: Command,
  };

  const IconComponent = iconMap[icon.toLowerCase()];

  if (!IconComponent) {
    // Default icon
    return <Code className="w-4 h-4 mr-3 text-gray-400" />;
  }

  return <IconComponent className="w-4 h-4 mr-3 text-gray-400" />;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<CommandSearchResult[]>([]);
  const [chainState, setChainState] = useState<CommandChainState | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const commandRegistry = getCommandRegistry();

  // Update search results when query changes
  useEffect(() => {
    if (!isOpen) return;

    const searchResults = commandRegistry.search(query, 10);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, isOpen, commandRegistry]);

  // Monitor chain state
  useEffect(() => {
    if (!isOpen) return;

    const checkChainState = () => {
      const currentChainState = commandRegistry.getChainState();
      setChainState(currentChainState);
    };

    const interval = setInterval(checkChainState, 50);
    return () => clearInterval(interval);
  }, [isOpen, commandRegistry]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;

      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        event.preventDefault();
        if (results[selectedIndex]) {
          executeSelectedCommand();
        }
        break;

      case 'Tab':
        event.preventDefault();
        if (results[selectedIndex]) {
          // Tab autocompletes the command title
          setQuery(results[selectedIndex].command.title);
        }
        break;
    }
  }, [results, selectedIndex, onClose]);

  // Execute the selected command
  const executeSelectedCommand = useCallback(async () => {
    const selectedResult = results[selectedIndex];
    if (!selectedResult) return;

    const success = await commandRegistry.execute(selectedResult.command.id);
    if (success) {
      onClose();
      setQuery('');
    }
  }, [results, selectedIndex, commandRegistry, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, isOpen]);

  // Memoized category groups for better performance
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CommandSearchResult[]> = {};
    
    results.forEach(result => {
      const category = result.command.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(result);
    });

    return groups;
  }, [results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-32 z-50">
      <div 
        className="rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{
          // GPU acceleration for smooth animations
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      >
        {/* Search Input */}
        <div className="relative border-b border-gray-200">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full pl-12 pr-4 py-4 text-lg outline-none bg-transparent"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          {/* Command chain indicator */}
          {chainState && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center text-sm text-gray-500">
              <Command className="w-4 h-4 mr-1" />
              {chainState.sequence.join(' → ')}
            </div>
          )}
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-96 overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {query ? 'No commands found' : 'Start typing to search commands...'}
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(categoryGroups).map(([category, categoryResults]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-t border-gray-200">
                    {category}
                  </div>
                  
                  {/* Commands in Category */}
                  {categoryResults.map((result) => {
                    const globalIndex = results.findIndex(r => r === result);
                    const isSelected = globalIndex === selectedIndex;
                    
                    return (
                      <CommandItem
                        key={result.command.id}
                        result={result}
                        isSelected={isSelected}
                        onClick={() => {
                          setSelectedIndex(globalIndex);
                          executeSelectedCommand();
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with hints */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <ArrowUp className="w-3 h-3 mr-1" />
              <ArrowDown className="w-3 h-3 mr-1" />
              navigate
            </div>
            <div className="flex items-center">
              <CornerDownLeft className="w-3 h-3 mr-1" />
              select
            </div>
            <div className="flex items-center">
              <kbd className="px-1 py-0.5 bg-white rounded text-xs">Tab</kbd>
              <span className="ml-1">autocomplete</span>
            </div>
          </div>
          <div className="flex items-center">
            <kbd className="px-1 py-0.5 bg-white rounded text-xs">Esc</kbd>
            <span className="ml-1">close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual command item component
interface CommandItemProps {
  result: CommandSearchResult;
  isSelected: boolean;
  onClick: () => void;
}

const CommandItem: React.FC<CommandItemProps> = React.memo(({ result, isSelected, onClick }) => {
  const { command, matchedKeywords } = result;

  return (
    <div
      className={`px-4 py-3 cursor-pointer border-l-2 transition-all ${
        isSelected 
          ? 'bg-blue-50 border-blue-500' 
          : 'border-transparent hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center min-w-0">
          <CommandIcon icon={command.icon || command.category} />
          <div className="flex-1 min-w-0">
            {/* Command Title */}
            <div className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
              {command.title}
            </div>
            
            {/* Command Description */}
            {command.description && (
              <div className="text-sm text-gray-500 mt-1 truncate">
                {command.description}
              </div>
            )}
            
            {/* Matched Keywords */}
            {matchedKeywords.length > 0 && (
              <div className="flex items-center mt-2 space-x-1">
                {matchedKeywords.slice(0, 3).map(keyword => (
                  <span 
                    key={keyword}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Keyboard Shortcut */}
        {command.shortcut && (
          <div className="flex-shrink-0 ml-4 flex items-center space-x-1">
            {command.shortcut.display.split('+').map(key => (
              <kbd key={key} className="px-1.5 py-1 bg-gray-200 text-gray-700 text-xs rounded-md font-mono border-b-2 border-gray-300">
                {key}
              </kbd>
            ))}
          </div>
        )}

        {/* Chainable Indicator */}
        {command.chainable && (
          <div className="flex-shrink-0 ml-2">
            <div className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded">
              {command.chainable.sequence.join(' → ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

CommandItem.displayName = 'CommandItem';