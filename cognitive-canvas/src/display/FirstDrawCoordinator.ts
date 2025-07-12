// First Draw Coordinator - Orchestrates the initial render sequence
// Order: Panels → Tabs → Content

import { DisplayState, displayState } from './DisplayState';

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

  // Execute the complete first draw sequence - optimized for speed
  async executeFirstDraw(): Promise<void> {
    if (this.isDrawing || this.hasDrawn) return;

    this.isDrawing = true;
    const startTime = performance.now();

    try {
      // Lightning-fast synchronous state load
      displayState.loadFromStorageSync();

      const context: RenderContext = {
        state: displayState.getState(),
        isFirstDraw: true,
        timestamp: Date.now()
      };

      // Execute all draw steps synchronously for speed
      for (const step of this.drawSteps) {
        await step.execute(context);
      }

      this.hasDrawn = true;
      
      // Async operations after render
      this.setupAutoSave();
      this.fadeInContent();

      const duration = performance.now() - startTime;
      console.log(`⚡ First draw completed in ${duration.toFixed(1)}ms`);

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

  // Fade in the content after first draw
  private fadeInContent(): void {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.style.opacity = '1';
      console.log('✨ Content faded in');
    }
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