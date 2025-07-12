/**
 * Performance Monitor
 * 
 * Enforces the 8ms rule and provides real-time performance feedback.
 */

export interface PerformanceMetrics {
  frameTime: number;
  inputLatency: number;
  commandLatency: number;
  renderLatency: number;
  memoryUsage: number;
  timestamp: number;
}

export interface PerformanceAlert {
  type: 'frame_drop' | 'input_lag' | 'memory_leak' | 'command_timeout';
  severity: 'warning' | 'critical';
  message: string;
  metrics: PerformanceMetrics;
  timestamp: number;
}

export interface PerformanceBudget {
  frameTime: number;     // 8ms default
  inputLatency: number;  // 2ms default
  commandLatency: number; // 5ms default
  renderLatency: number; // 3ms default
  memoryLimit: number;   // 100MB default
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private budget: PerformanceBudget;
  private isMonitoring = false;
  private readonly maxMetricsHistory = 300; // 5 seconds at 60fps
  private readonly maxAlertsHistory = 100;

  constructor(budget?: Partial<PerformanceBudget>) {
    this.budget = {
      frameTime: 8,
      inputLatency: 2,
      commandLatency: 5,
      renderLatency: 3,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      ...budget
    };
    
    this.setupObservers();
  }

  private setupObservers(): void {
    // Frame timing observer
    if ('PerformanceObserver' in window) {
      const frameObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' && entry.name === 'frame') {
            this.recordFrameTime(entry.duration);
          }
        });
      });
      
      frameObserver.observe({ entryTypes: ['measure'] });
      this.observers.push(frameObserver);
    }

    // Long task observer
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > this.budget.frameTime) {
            this.addAlert({
              type: 'frame_drop',
              severity: entry.duration > this.budget.frameTime * 2 ? 'critical' : 'warning',
              message: `Long task detected: ${entry.duration.toFixed(2)}ms`,
              metrics: this.getCurrentMetrics(),
              timestamp: performance.now()
            });
          }
        });
      });
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }
    }
  }

  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.scheduleMetricsCollection();
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
  }

  private scheduleMetricsCollection(): void {
    if (!this.isMonitoring) return;
    
    // Collect metrics at 60fps
    requestAnimationFrame(() => {
      this.collectMetrics();
      this.scheduleMetricsCollection();
    });
  }

  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      frameTime: this.measureFrameTime(),
      inputLatency: this.getAverageInputLatency(),
      commandLatency: this.getAverageCommandLatency(),
      renderLatency: this.getAverageRenderLatency(),
      memoryUsage: this.getMemoryUsage(),
      timestamp: performance.now()
    };

    this.addMetrics(metrics);
    this.checkBudgetViolations(metrics);
  }

  private measureFrameTime(): number {
    // Start frame measurement
    performance.mark('frame-start');
    
    // End frame measurement (will be completed next frame)
    requestAnimationFrame(() => {
      performance.mark('frame-end');
      performance.measure('frame', 'frame-start', 'frame-end');
    });
    
    // Return last measured frame time
    const frameEntries = performance.getEntriesByName('frame', 'measure');
    return frameEntries.length > 0 ? frameEntries[frameEntries.length - 1].duration : 0;
  }

  private getAverageInputLatency(): number {
    // This would be integrated with InputProcessor
    // For now, return 0 as placeholder
    return 0;
  }

  private getAverageCommandLatency(): number {
    // This would be integrated with CommandProcessor
    // For now, return 0 as placeholder
    return 0;
  }

  private getAverageRenderLatency(): number {
    // This would be integrated with RenderEngine
    // For now, return 0 as placeholder
    return 0;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }
  }

  private checkBudgetViolations(metrics: PerformanceMetrics): void {
    // Check frame time
    if (metrics.frameTime > this.budget.frameTime) {
      this.addAlert({
        type: 'frame_drop',
        severity: metrics.frameTime > this.budget.frameTime * 2 ? 'critical' : 'warning',
        message: `Frame time exceeded budget: ${metrics.frameTime.toFixed(2)}ms > ${this.budget.frameTime}ms`,
        metrics,
        timestamp: metrics.timestamp
      });
    }

    // Check input latency
    if (metrics.inputLatency > this.budget.inputLatency) {
      this.addAlert({
        type: 'input_lag',
        severity: 'warning',
        message: `Input latency exceeded budget: ${metrics.inputLatency.toFixed(2)}ms > ${this.budget.inputLatency}ms`,
        metrics,
        timestamp: metrics.timestamp
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > this.budget.memoryLimit) {
      this.addAlert({
        type: 'memory_leak',
        severity: 'critical',
        message: `Memory usage exceeded budget: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB > ${(this.budget.memoryLimit / 1024 / 1024).toFixed(2)}MB`,
        metrics,
        timestamp: metrics.timestamp
      });
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts.shift();
    }
    
    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`Performance Alert: ${alert.message}`);
    } else {
      console.warn(`Performance Warning: ${alert.message}`);
    }
  }

  private getCurrentMetrics(): PerformanceMetrics {
    return this.metrics.length > 0 
      ? this.metrics[this.metrics.length - 1]
      : {
          frameTime: 0,
          inputLatency: 0,
          commandLatency: 0,
          renderLatency: 0,
          memoryUsage: 0,
          timestamp: performance.now()
        };
  }

  // Public API
  public getMetrics(count = 60): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  public getAlerts(count = 20): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  public getAverageFrameTime(sampleSize = 60): number {
    const recentMetrics = this.getMetrics(sampleSize);
    if (recentMetrics.length === 0) return 0;
    
    return recentMetrics.reduce((sum, m) => sum + m.frameTime, 0) / recentMetrics.length;
  }

  public getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  public updateBudget(newBudget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...newBudget };
  }

  public clearMetrics(): void {
    this.metrics = [];
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  public getPerformanceScore(): number {
    const recentMetrics = this.getMetrics(60);
    if (recentMetrics.length === 0) return 100;

    let score = 100;
    
    // Deduct points for budget violations
    recentMetrics.forEach(metric => {
      if (metric.frameTime > this.budget.frameTime) {
        score -= 2;
      }
      if (metric.inputLatency > this.budget.inputLatency) {
        score -= 1;
      }
      if (metric.memoryUsage > this.budget.memoryLimit) {
        score -= 5;
      }
    });

    return Math.max(0, score);
  }

  public destroy(): void {
    this.stopMonitoring();
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
    this.alerts = [];
  }
}

// Export singleton
let performanceMonitorInstance: PerformanceMonitor | null = null;

export const getPerformanceMonitor = (budget?: Partial<PerformanceBudget>): PerformanceMonitor => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor(budget);
  }
  return performanceMonitorInstance;
};

export const destroyPerformanceMonitor = (): void => {
  if (performanceMonitorInstance) {
    performanceMonitorInstance.destroy();
    performanceMonitorInstance = null;
  }
};