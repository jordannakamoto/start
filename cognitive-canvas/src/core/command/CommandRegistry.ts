/**
 * Command Registry - The Heart of the Command Palette
 * 
 * This is the central nervous system for all user actions.
 * Every action that can be performed in the application flows through this registry.
 */

export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  keywords: string[];
  shortcut?: KeyboardShortcut;
  when?: ContextCondition;
  icon?: string;
  execute: CommandExecutor;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  cmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  display: string; // Human-readable format like "Cmd+K"
}


export interface ContextCondition {
  // Conditions that must be true for command to be available
  hasActiveDocument?: boolean;
  hasSelection?: boolean;
  documentDirty?: boolean;
  editorFocused?: boolean;
  modalOpen?: boolean;
  custom?: () => boolean;
}

export type CommandCategory = 
  | 'file'
  | 'edit'
  | 'view'
  | 'document'
  | 'format'
  | 'tools'
  | 'help'
  | 'debug';

export type CommandExecutor = (args?: any) => Promise<void> | void;

export interface CommandSearchResult {
  command: CommandDefinition;
  score: number;
  matchedKeywords: string[];
}


export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private shortcuts = new Map<string, CommandDefinition>();
  private contextState: Record<string, any> = {};

  constructor() {
    this.registerBuiltinCommands();
    this.setupGlobalKeyboardHandlers();
  }

  // Register a command in the registry
  public register(command: CommandDefinition): void {
    // Validate command
    if (!command.id || !command.title || !command.execute) {
      throw new Error('Invalid command definition');
    }

    if (this.commands.has(command.id)) {
      console.warn(`Command ${command.id} already registered, overwriting`);
    }

    this.commands.set(command.id, command);

    // Register keyboard shortcut
    if (command.shortcut) {
      const shortcutKey = this.getShortcutKey(command.shortcut);
      this.shortcuts.set(shortcutKey, command);
    }

  }

  // Unregister a command
  public unregister(commandId: string): void {
    const command = this.commands.get(commandId);
    if (!command) return;

    this.commands.delete(commandId);

    // Remove shortcut mapping
    if (command.shortcut) {
      const shortcutKey = this.getShortcutKey(command.shortcut);
      this.shortcuts.delete(shortcutKey);
    }

  }

  // Execute a command by ID
  public async execute(commandId: string, args?: any): Promise<boolean> {
    const command = this.commands.get(commandId);
    if (!command) {
      console.error(`Command not found: ${commandId}`);
      return false;
    }

    // Check context conditions
    if (!this.checkContext(command.when)) {
      console.warn(`Command ${commandId} not available in current context`);
      return false;
    }

    try {
      await command.execute(args);
      return true;
    } catch (error) {
      console.error(`Command execution failed: ${commandId}`, error);
      return false;
    }
  }

  // Search commands with fuzzy matching
  public search(query: string, limit = 20): CommandSearchResult[] {
    if (!query.trim()) {
      return this.getAvailableCommands(limit)
        .map(cmd => ({ command: cmd, score: 1, matchedKeywords: [] }));
    }

    const results: CommandSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const command of this.commands.values()) {
      if (!this.checkContext(command.when)) continue;

      const score = this.calculateMatchScore(command, queryLower);
      if (score > 0) {
        const matchedKeywords = this.getMatchedKeywords(command, queryLower);
        results.push({ command, score, matchedKeywords });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Get commands by category
  public getByCategory(category: CommandCategory): CommandDefinition[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.category === category && this.checkContext(cmd.when));
  }

  // Get all available commands in current context
  public getAvailableCommands(limit?: number): CommandDefinition[] {
    const available = Array.from(this.commands.values())
      .filter(cmd => this.checkContext(cmd.when));
    
    return limit ? available.slice(0, limit) : available;
  }

  // Handle keyboard shortcut
  public handleKeyboardShortcut(event: KeyboardEvent): boolean {
    const shortcutKey = this.getShortcutKeyFromEvent(event);
    const command = this.shortcuts.get(shortcutKey);

    if (command && this.checkContext(command.when)) {
      event.preventDefault();
      this.execute(command.id);
      return true;
    }

    return false;
  }


  // Update context state
  public updateContext(updates: Record<string, any>): void {
    this.contextState = { ...this.contextState, ...updates };
  }

  // Private helper methods
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.cmd) parts.push('cmd');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  private getShortcutKeyFromEvent(event: KeyboardEvent): string {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.metaKey) parts.push('cmd');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  private checkContext(condition?: ContextCondition): boolean {
    if (!condition) return true;

    if (condition.hasActiveDocument !== undefined) {
      if (condition.hasActiveDocument !== !!this.contextState.activeDocument) {
        return false;
      }
    }

    if (condition.hasSelection !== undefined) {
      if (condition.hasSelection !== !!this.contextState.hasSelection) {
        return false;
      }
    }

    if (condition.documentDirty !== undefined) {
      if (condition.documentDirty !== !!this.contextState.documentDirty) {
        return false;
      }
    }

    if (condition.editorFocused !== undefined) {
      if (condition.editorFocused !== !!this.contextState.editorFocused) {
        return false;
      }
    }

    if (condition.modalOpen !== undefined) {
      if (condition.modalOpen !== !!this.contextState.modalOpen) {
        return false;
      }
    }

    if (condition.custom) {
      return condition.custom();
    }

    return true;
  }

  private calculateMatchScore(command: CommandDefinition, query: string): number {
    let score = 0;

    // Exact title match
    if (command.title.toLowerCase() === query) {
      score += 100;
    }
    // Title starts with query
    else if (command.title.toLowerCase().startsWith(query)) {
      score += 50;
    }
    // Title contains query
    else if (command.title.toLowerCase().includes(query)) {
      score += 25;
    }

    // Description contains query
    if (command.description?.toLowerCase().includes(query)) {
      score += 10;
    }

    // Keywords match
    for (const keyword of command.keywords) {
      if (keyword.toLowerCase() === query) {
        score += 30;
      } else if (keyword.toLowerCase().includes(query)) {
        score += 15;
      }
    }

    return score;
  }

  private getMatchedKeywords(command: CommandDefinition, query: string): string[] {
    return command.keywords.filter(keyword => 
      keyword.toLowerCase().includes(query)
    );
  }


  private setupGlobalKeyboardHandlers(): void {
    document.addEventListener('keydown', (event) => {
      // Handle escape key (universal undo)
      if (event.key === 'Escape') {
        this.handleEscapeKey();
        return;
      }

      // Handle shortcuts
      if (this.handleKeyboardShortcut(event)) {
        return;
      }

    });
  }

  private handleEscapeKey(): void {
    // Execute context-appropriate escape action
    this.execute('core.escape');
  }


  private registerBuiltinCommands(): void {
    // Core escape command
    this.register({
      id: 'core.escape',
      title: 'Escape',
      description: 'Universal undo/cancel action',
      category: 'edit',
      keywords: ['escape', 'cancel', 'undo'],
      execute: () => {
        // Implementation will handle context-specific escape actions
        console.log('Escape pressed - context-specific action');
      }
    });

    // Command palette toggle
    this.register({
      id: 'core.command-palette',
      title: 'Open Command Palette',
      description: 'Show the command palette',
      category: 'tools',
      keywords: ['palette', 'commands', 'search'],
      shortcut: {
        key: 'p',
        cmd: true,
        display: 'Cmd+P'
      },
      execute: () => {
        // Will be implemented by CommandPalette component
      }
    });

    // Help overlay
    this.register({
      id: 'core.help',
      title: 'Show Keyboard Shortcuts',
      description: 'Display contextual keyboard shortcuts',
      category: 'help',
      keywords: ['help', 'shortcuts', 'keys'],
      shortcut: {
        key: '?',
        display: '?'
      },
      execute: () => {
        // Will be implemented by HelpOverlay component
      }
    });
  }
}

// Export singleton instance
let commandRegistryInstance: CommandRegistry | null = null;

export const getCommandRegistry = (): CommandRegistry => {
  if (!commandRegistryInstance) {
    commandRegistryInstance = new CommandRegistry();
  }
  return commandRegistryInstance;
};

export const destroyCommandRegistry = (): void => {
  commandRegistryInstance = null;
};