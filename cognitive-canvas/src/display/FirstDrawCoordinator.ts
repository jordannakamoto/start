// First Draw Coordinator - Orchestrates the initial render sequence
// Order: Panels → Tabs → Content

import { displayState, DisplayState } from './DisplayState';

export interface RenderContext {
  state: DisplayState;
  isFirstDraw: boolean;
  timestamp: number;
}

export interface DrawStep {
  name: string;
  order: number;
  execute: (context: RenderContext) => Promise<void>;
}

class FirstDrawCoordinator {
  private static instance: FirstDrawCoordinator;
  private drawSteps: DrawStep[] = [];
  private isDrawing = false;
  private hasDrawn = false;

  private constructor() {}

  static getInstance(): FirstDrawCoordinator {
    if (!FirstDrawCoordinator.instance) {
      FirstDrawCoordinator.instance = new FirstDrawCoordinator();
    }
    return FirstDrawCoordinator.instance;
  }

  // Register a draw step
  registerDrawStep(step: DrawStep): void {
    this.drawSteps.push(step);
    // Keep steps sorted by order
    this.drawSteps.sort((a, b) => a.order - b.order);
    console.log(`🎨 Registered draw step: ${step.name} (order: ${step.order})`);
  }

  // Execute the complete first draw sequence
  async executeFirstDraw(): Promise<void> {
    if (this.isDrawing || this.hasDrawn) {
      console.log('🎨 First draw already executed or in progress');
      return;
    }

    this.isDrawing = true;
    console.log('🎨 Starting first draw sequence...');

    try {
      // Load state from storage first - wait for it to complete
      await this.waitForStateLoad();

      const context: RenderContext = {
        state: displayState.getState(),
        isFirstDraw: true,
        timestamp: Date.now()
      };

      console.log('🎨 Executing draw steps in order:', this.drawSteps.map(s => s.name));

      // Execute each draw step in order
      for (const step of this.drawSteps) {
        console.log(`🎨 Executing: ${step.name}`);
        await step.execute(context);
      }

      this.hasDrawn = true;
      console.log('✅ First draw sequence completed');

      // Setup auto-save after first draw
      this.setupAutoSave();

    } catch (error) {
      console.error('❌ First draw failed:', error);
    } finally {
      this.isDrawing = false;
    }
  }

  // Check if first draw has been completed
  hasCompletedFirstDraw(): boolean {
    return this.hasDrawn;
  }

  // Force a re-draw (for state changes)
  async redraw(): Promise<void> {
    if (this.isDrawing) return;

    console.log('🔄 Executing redraw...');
    
    const context: RenderContext = {
      state: displayState.getState(),
      isFirstDraw: false,
      timestamp: Date.now()
    };

    // Execute only the necessary steps for updates
    for (const step of this.drawSteps) {
      await step.execute(context);
    }
  }

  private setupAutoSave(): void {
    // Emergency save on page unload (sync fallback)
    window.addEventListener('beforeunload', () => {
      displayState.saveToStorageSync();
    });
  }

  // Wait for state to load from storage
  private async waitForStateLoad(): Promise<void> {
    return new Promise((resolve) => {
      // First try sync load as immediate fallback
      displayState.loadFromStorageSync();
      
      // Then try async load via worker (will update state if it gets data)
      displayState.loadFromStorage();
      
      // Give worker a short time to respond, then continue
      setTimeout(() => {
        console.log('🎨 State load completed (sync + async)');
        resolve();
      }, 100); // 100ms should be enough for worker to respond
    });
  }

  // Get registered steps (for debugging)
  getDrawSteps(): DrawStep[] {
    return [...this.drawSteps];
  }

  // Reset coordinator (for testing)
  reset(): void {
    this.hasDrawn = false;
    this.isDrawing = false;
    this.drawSteps = [];
  }
}

// Export singleton
export const firstDrawCoordinator = FirstDrawCoordinator.getInstance();

// Utility function to register draw steps easily
export function registerDrawStep(name: string, order: number, execute: (context: RenderContext) => Promise<void>): void {
  firstDrawCoordinator.registerDrawStep({ name, order, execute });
}