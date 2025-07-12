/**
 * Performance-related type definitions
 */

export interface FrameMetrics {
  frameTime: number;
  renderTime: number;
  updateTime: number;
  timestamp: number;
}

export interface InputMetrics {
  latency: number;
  throughput: number;
  droppedEvents: number;
}

export interface MemoryMetrics {
  used: number;
  allocated: number;
  limit: number;
  gcCount: number;
}

export interface PerformanceBudgets {
  maxFrameTime: number;
  maxInputLatency: number;
  maxMemoryUsage: number;
  maxCommandLatency: number;
}

export type PerformanceLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';

export interface PerformanceProfile {
  level: PerformanceLevel;
  score: number;
  bottlenecks: string[];
  recommendations: string[];
}