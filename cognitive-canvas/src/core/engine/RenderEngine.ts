/**
 * GPU-First Rendering Engine
 * 
 * Bypasses DOM for text rendering to achieve sub-8ms frame times.
 * All text operations are hardware-accelerated via Canvas API.
 */

export interface RenderMetrics {
  frameTime: number;
  drawCalls: number;
  verticesDrawn: number;
  lastFrameTimestamp: number;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextRenderRequest {
  text: string;
  x: number;
  y: number;
  font: string;
  color: string;
  selection?: { start: number; end: number };
}

export class RenderEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private metrics: RenderMetrics;
  private viewport: ViewportBounds;
  private pendingRenders: TextRenderRequest[] = [];
  private framebudget = 8; // 8ms maximum frame time

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = this.initializeContext();
    this.metrics = {
      frameTime: 0,
      drawCalls: 0,
      verticesDrawn: 0,
      lastFrameTimestamp: 0
    };
    this.viewport = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    };
    
    this.setupCanvas();
    this.startRenderLoop();
  }

  private initializeContext(): CanvasRenderingContext2D {
    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // Allow GPU composition
      willReadFrequently: false
    });
    
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    // Enable hardware acceleration hints
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'top';
    
    return ctx;
  }

  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // Set actual size in memory (scaled for retina)
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // Scale canvas back down using CSS
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // Scale the drawing context so everything draws at the correct size
    this.ctx.scale(dpr, dpr);
  }

  private startRenderLoop(): void {
    const render = (timestamp: number) => {
      const frameStart = performance.now();
      
      this.renderFrame();
      
      const frameTime = performance.now() - frameStart;
      this.updateMetrics(frameTime, timestamp);
      
      // Only request next frame if we have work or are under budget
      if (this.pendingRenders.length > 0 || frameTime < this.framebudget) {
        this.animationFrameId = requestAnimationFrame(render);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(render);
  }

  private renderFrame(): void {
    if (this.pendingRenders.length === 0) return;

    // Clear only the dirty regions for better performance
    this.clearViewport();
    
    // Batch render all pending text
    this.renderTextBatch(this.pendingRenders);
    
    // Clear pending renders
    this.pendingRenders = [];
    this.metrics.drawCalls++;
  }

  private clearViewport(): void {
    this.ctx.clearRect(
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height
    );
  }

  private renderTextBatch(requests: TextRenderRequest[]): void {
    // Group by font for better batching
    const fontGroups = new Map<string, TextRenderRequest[]>();
    
    for (const request of requests) {
      if (!fontGroups.has(request.font)) {
        fontGroups.set(request.font, []);
      }
      fontGroups.get(request.font)!.push(request);
    }

    // Render each font group
    for (const [font, group] of fontGroups) {
      this.ctx.font = font;
      
      for (const request of group) {
        this.renderSingleText(request);
      }
    }
  }

  private renderSingleText(request: TextRenderRequest): void {
    this.ctx.fillStyle = request.color;
    
    // Render selection background if present
    if (request.selection) {
      this.renderSelection(request);
    }
    
    // Render text
    this.ctx.fillText(request.text, request.x, request.y);
    
    this.metrics.verticesDrawn += request.text.length;
  }

  private renderSelection(request: TextRenderRequest): void {
    if (!request.selection) return;

    const { start, end } = request.selection;
    const beforeText = request.text.slice(0, start);
    const selectedText = request.text.slice(start, end);
    
    const beforeWidth = this.ctx.measureText(beforeText).width;
    const selectedWidth = this.ctx.measureText(selectedText).width;
    
    // Render selection background
    this.ctx.fillStyle = '#3B82F6'; // Blue selection
    this.ctx.fillRect(
      request.x + beforeWidth,
      request.y,
      selectedWidth,
      20 // TODO: Calculate line height dynamically
    );
  }

  private updateMetrics(frameTime: number, timestamp: number): void {
    this.metrics.frameTime = frameTime;
    this.metrics.lastFrameTimestamp = timestamp;
    
    // Log performance violations
    if (frameTime > this.framebudget) {
      console.warn(`Frame budget exceeded: ${frameTime.toFixed(2)}ms > ${this.framebudget}ms`);
    }
  }

  // Public API
  public queueTextRender(request: TextRenderRequest): void {
    this.pendingRenders.push(request);
    
    // Restart render loop if stopped
    if (this.animationFrameId === null) {
      this.startRenderLoop();
    }
  }

  public updateViewport(bounds: ViewportBounds): void {
    this.viewport = bounds;
  }

  public getMetrics(): RenderMetrics {
    return { ...this.metrics };
  }

  public setFrameBudget(ms: number): void {
    this.framebudget = ms;
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// Export singleton instance
let renderEngineInstance: RenderEngine | null = null;

export const getRenderEngine = (canvas?: HTMLCanvasElement): RenderEngine => {
  if (!renderEngineInstance && canvas) {
    renderEngineInstance = new RenderEngine(canvas);
  }
  if (!renderEngineInstance) {
    throw new Error('RenderEngine not initialized. Pass a canvas to getRenderEngine()');
  }
  return renderEngineInstance;
};

export const destroyRenderEngine = (): void => {
  if (renderEngineInstance) {
    renderEngineInstance.destroy();
    renderEngineInstance = null;
  }
};