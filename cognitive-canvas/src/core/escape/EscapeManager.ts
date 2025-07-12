import { useEffect } from 'react';

/**
 * Universal Escape Manager
 * 
 * Escape is the most important key - it always performs a logical, predictable "step back" action.
 * This manager maintains a stack of escape contexts and handles the universal undo behavior.
 */

export interface EscapeContext {
  id: string;
  priority: number; // Higher priority contexts handle escape first
  canEscape: () => boolean;
  onEscape: () => void;
  description: string;
}

export interface EscapeState {
  activeContexts: EscapeContext[];
  lastEscapeTime: number;
  escapeCount: number;
}

export class EscapeManager {
  private contexts: EscapeContext[] = [];
  private state: EscapeState = {
    activeContexts: [],
    lastEscapeTime: 0,
    escapeCount: 0
  };

  constructor() {
    this.setupGlobalEscapeHandler();
    this.registerBuiltinContexts();
  }

  // Register an escape context
  public register(context: EscapeContext): void {
    // Remove existing context with same ID
    this.unregister(context.id);
    
    // Insert in priority order (higher priority first)
    const insertIndex = this.contexts.findIndex(ctx => ctx.priority < context.priority);
    if (insertIndex === -1) {
      this.contexts.push(context);
    } else {
      this.contexts.splice(insertIndex, 0, context);
    }

    this.updateActiveContexts();
  }

  // Unregister an escape context
  public unregister(contextId: string): void {
    this.contexts = this.contexts.filter(ctx => ctx.id !== contextId);
    this.updateActiveContexts();
  }

  // Handle escape key press
  public handleEscape(): boolean {
    const now = performance.now();
    this.state.lastEscapeTime = now;
    this.state.escapeCount++;

    // Find the highest priority context that can handle escape
    for (const context of this.state.activeContexts) {
      if (context.canEscape()) {
        try {
          context.onEscape();
          console.log(`Escape handled by: ${context.description}`);
          return true;
        } catch (error) {
          console.error(`Escape handler failed for ${context.id}:`, error);
          continue;
        }
      }
    }

    // If no context handled it, perform default escape action
    this.performDefaultEscape();
    return true;
  }

  // Get current escape state for debugging
  public getState(): EscapeState {
    return { ...this.state };
  }

  // Get all registered contexts
  public getContexts(): EscapeContext[] {
    return [...this.contexts];
  }

  // Update which contexts are currently active
  private updateActiveContexts(): void {
    this.state.activeContexts = this.contexts.filter(ctx => ctx.canEscape());
  }

  // Setup global escape key handler
  private setupGlobalEscapeHandler(): void {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.handleEscape();
      }
    }, true); // Use capturing phase for highest priority
  }

  // Register built-in escape contexts
  private registerBuiltinContexts(): void {
    // Modal/Dialog closer (highest priority)
    this.register({
      id: 'modal-closer',
      priority: 1000,
      canEscape: () => this.hasOpenModal(),
      onEscape: () => this.closeTopModal(),
      description: 'Close modal or dialog'
    });

    // Command palette closer
    this.register({
      id: 'command-palette-closer',
      priority: 900,
      canEscape: () => this.isCommandPaletteOpen(),
      onEscape: () => this.closeCommandPalette(),
      description: 'Close command palette'
    });

    // Help overlay closer
    this.register({
      id: 'help-closer',
      priority: 800,
      canEscape: () => this.isHelpOpen(),
      onEscape: () => this.closeHelp(),
      description: 'Close help overlay'
    });

    // Selection clearer
    this.register({
      id: 'selection-clearer',
      priority: 700,
      canEscape: () => this.hasSelection(),
      onEscape: () => this.clearSelection(),
      description: 'Clear text selection'
    });

    // Command chain resetter
    this.register({
      id: 'chain-resetter',
      priority: 600,
      canEscape: () => this.hasActiveCommandChain(),
      onEscape: () => this.resetCommandChain(),
      description: 'Reset command chain'
    });

    // Search clearer
    this.register({
      id: 'search-clearer',
      priority: 500,
      canEscape: () => this.hasActiveSearch(),
      onEscape: () => this.clearSearch(),
      description: 'Clear search'
    });

    // Focus resetter (lowest priority)
    this.register({
      id: 'focus-resetter',
      priority: 100,
      canEscape: () => this.hasSpecialFocus(),
      onEscape: () => this.resetFocus(),
      description: 'Return focus to editor'
    });
  }

  // Default escape action when no context handles it
  private performDefaultEscape(): void {
    // Return focus to the main editor
    const editorElement = document.querySelector('[data-lexical-editor]') as HTMLElement;
    if (editorElement) {
      editorElement.focus();
    }
    
    console.log('Escape: Returned to main editor');
  }

  // Context checker methods
  private hasOpenModal(): boolean {
    return document.querySelector('[role="dialog"], .modal, [data-modal]') !== null;
  }

  private isCommandPaletteOpen(): boolean {
    return document.querySelector('[data-command-palette]') !== null;
  }

  private isHelpOpen(): boolean {
    return document.querySelector('[data-help-overlay]') !== null;
  }

  private hasSelection(): boolean {
    const selection = window.getSelection();
    return selection !== null && !selection.isCollapsed;
  }

  private hasActiveCommandChain(): boolean {
    // Check with command registry
    const commandRegistry = (window as any).__commandRegistry;
    return commandRegistry?.getChainState() !== null;
  }

  private hasActiveSearch(): boolean {
    const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search" i]');
    return Array.from(searchInputs).some(input => (input as HTMLInputElement).value.length > 0);
  }

  private hasSpecialFocus(): boolean {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    // Check if focus is on a form element outside the editor
    return activeElement.tagName === 'INPUT' || 
           activeElement.tagName === 'TEXTAREA' || 
           activeElement.tagName === 'SELECT' ||
           activeElement.hasAttribute('contenteditable');
  }

  // Action methods
  private closeTopModal(): void {
    const modal = document.querySelector('[role="dialog"], .modal, [data-modal]') as HTMLElement;
    if (modal) {
      // Try to find and click close button
      const closeButton = modal.querySelector('[aria-label="Close"], [data-close], .close') as HTMLElement;
      if (closeButton) {
        closeButton.click();
      } else {
        // Remove modal if no close button found
        modal.remove();
      }
    }
  }

  private closeCommandPalette(): void {
    const palette = document.querySelector('[data-command-palette]') as HTMLElement;
    if (palette) {
      // Dispatch custom event to close palette
      palette.dispatchEvent(new CustomEvent('close'));
    }
  }

  private closeHelp(): void {
    const help = document.querySelector('[data-help-overlay]') as HTMLElement;
    if (help) {
      help.dispatchEvent(new CustomEvent('close'));
    }
  }

  private clearSelection(): void {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  private resetCommandChain(): void {
    const commandRegistry = (window as any).__commandRegistry;
    if (commandRegistry?.resetChain) {
      commandRegistry.resetChain();
    }
  }

  private clearSearch(): void {
    const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search" i]');
    searchInputs.forEach(input => {
      (input as HTMLInputElement).value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  private resetFocus(): void {
    // Find the main editor and focus it
    const editor = document.querySelector('[data-lexical-editor]') as HTMLElement;
    if (editor) {
      editor.focus();
    } else {
      // Fallback: focus the main content area
      const main = document.querySelector('main, [role="main"]') as HTMLElement;
      if (main) {
        main.focus();
      }
    }
  }
}

// Export singleton
let escapeManagerInstance: EscapeManager | null = null;

export const getEscapeManager = (): EscapeManager => {
  if (!escapeManagerInstance) {
    escapeManagerInstance = new EscapeManager();
  }
  return escapeManagerInstance;
};

export const destroyEscapeManager = (): void => {
  escapeManagerInstance = null;
};

// Utility hook for React components to register escape contexts
export const useEscapeContext = (context: Omit<EscapeContext, 'id'> & { id?: string }) => {
  useEffect(() => {
    const escapeManager = getEscapeManager();
    const contextId = context.id || `react-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullContext: EscapeContext = {
      ...context,
      id: contextId
    };

    escapeManager.register(fullContext);

    return () => {
      escapeManager.unregister(contextId);
    };
  }, [context]);
};