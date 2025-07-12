/**
 * Contextual Help Overlay - Silent Guide on Demand
 * 
 * The ? key brings up context-aware shortcuts that disappear without a trace.
 * Shows only the minimal set of shortcuts relevant to the current context.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Keyboard, X } from 'lucide-react';
import { getCommandRegistry, CommandDefinition } from '../../core/command/CommandRegistry';

interface HelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: CommandDefinition[];
  priority: number; // Lower = higher priority
}

export const HelpOverlay: React.FC<HelpOverlayProps> = ({ isOpen, onClose }) => {
  const [context] = useState<string>('general');
  const commandRegistry = getCommandRegistry();

  // Get contextual shortcuts
  const contextualShortcuts = useMemo(() => {
    const availableCommands = commandRegistry.getAvailableCommands()
      .filter(cmd => cmd.shortcut);

    // Group by context and category
    const groups: ShortcutGroup[] = [
      {
        title: 'Essential',
        priority: 1,
        shortcuts: availableCommands.filter(cmd => 
          ['core.command-palette', 'core.help', 'core.escape'].includes(cmd.id)
        )
      },
      {
        title: 'Navigation',
        priority: 2,
        shortcuts: availableCommands.filter(cmd => 
          cmd.category === 'view' || cmd.keywords.includes('navigate')
        )
      },
      {
        title: 'Editing',
        priority: 3,
        shortcuts: availableCommands.filter(cmd => 
          cmd.category === 'edit' && cmd.shortcut
        )
      },
      {
        title: 'File Operations',
        priority: 4,
        shortcuts: availableCommands.filter(cmd => 
          cmd.category === 'file' && cmd.shortcut
        )
      },
      {
        title: 'Formatting',
        priority: 5,
        shortcuts: availableCommands.filter(cmd => 
          cmd.category === 'format' && cmd.shortcut
        )
      },
      {
        title: 'Advanced',
        priority: 6,
        shortcuts: availableCommands.filter(cmd => 
          cmd.chainable || cmd.keywords.includes('advanced')
        )
      }
    ].filter(group => group.shortcuts.length > 0)
     .sort((a, b) => a.priority - b.priority);

    return groups;
  }, [commandRegistry, context]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === '?') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-close after period of inactivity
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      onClose();
    }, 10000); // Auto-close after 10 seconds

    return () => clearTimeout(timeout);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      >
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Keyboard className="w-5 h-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
            <span className="ml-2 text-sm text-gray-500">({context} context)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contextualShortcuts.map((group) => (
              <ShortcutGroup key={group.title} group={group} />
            ))}
          </div>

          {/* Pro Tips */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Press <kbd className="px-1 bg-blue-100 rounded">Cmd+K</kbd> to open the command palette - your gateway to everything</li>
              <li>• <kbd className="px-1 bg-blue-100 rounded">Escape</kbd> is your universal "step back" - always returns you to safety</li>
              <li>• Type <kbd className="px-1 bg-blue-100 rounded">?</kbd> anywhere to see context-relevant shortcuts</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between text-sm text-gray-500">
          <div>Press <kbd className="px-1 py-0.5 bg-white rounded">?</kbd> or <kbd className="px-1 py-0.5 bg-white rounded">Esc</kbd> to close</div>
          <div>Context updates automatically based on your current focus</div>
        </div>
      </div>
    </div>
  );
};

// Individual shortcut group component
interface ShortcutGroupProps {
  group: ShortcutGroup;
}

const ShortcutGroup: React.FC<ShortcutGroupProps> = ({ group }) => {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
        {group.title}
      </h3>
      <div className="space-y-2">
        {group.shortcuts.map((command) => (
          <ShortcutItem key={command.id} command={command} />
        ))}
      </div>
    </div>
  );
};

// Individual shortcut item
interface ShortcutItemProps {
  command: CommandDefinition;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ command }) => {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {command.title}
        </div>
        {command.description && (
          <div className="text-xs text-gray-500 truncate">
            {command.description}
          </div>
        )}
      </div>
      
      <div className="flex-shrink-0 ml-3">
        {command.shortcut ? (
          <kbd className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-mono border">
            {command.shortcut.display}
          </kbd>
        ) : null}
      </div>
    </div>
  );
};