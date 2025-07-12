/**
 * High-Performance Application Entry Point
 * 
 * Optimized for the 8ms rule with lazy loading and performance monitoring.
 */

import React, { useEffect, useRef, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { getRenderEngine, destroyRenderEngine } from '../core/engine/RenderEngine';
import { getInputProcessor, destroyInputProcessor } from '../core/input/InputProcessor';
import { getCommandProcessor, destroyCommandProcessor } from '../core/command/CommandProcessor';
import { getPerformanceMonitor, destroyPerformanceMonitor } from '../core/performance/PerformanceMonitor';
import { initializeDocumentStore, useDocumentStore } from '../features/documents/DocumentStore';

// Lazy loaded components for better startup performance
const WorkspaceManager = React.lazy(() => 
  import('../features/workspace/WorkspaceManager').then(module => ({
    default: module.WorkspaceManager
  }))
);

const EditorCore = React.lazy(() => 
  import('../features/editor/EditorCore').then(module => ({
    default: module.EditorCore
  }))
);


// Loading fallback optimized for minimal render cost
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-gray-500 animate-pulse">{message}</div>
  </div>
);

// Error fallback for error boundary
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <div className="flex flex-col items-center justify-center h-full p-8">
    <h2 className="text-xl font-semibold text-red-600 mb-4">Something went wrong</h2>
    <p className="text-gray-600 mb-4 text-center">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Try again
    </button>
  </div>
);

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const performanceMonitor = useRef(getPerformanceMonitor({
    frameTime: 8,      // 8ms rule
    inputLatency: 2,   // 2ms input response
    commandLatency: 5, // 5ms command processing
    renderLatency: 3,  // 3ms render time
    memoryLimit: 200 * 1024 * 1024 // 200MB memory limit
  }));

  // Initialize core systems on mount
  useEffect(() => {
    const initializeSystems = async () => {
      try {
        // Start performance monitoring immediately
        performanceMonitor.current.startMonitoring();
        
        // Initialize GPU rendering engine
        if (canvasRef.current) {
          getRenderEngine(canvasRef.current);
        }
        
        // Initialize input processor
        if (appContainerRef.current) {
          getInputProcessor(appContainerRef.current);
        }
        
        // Initialize command processor
        getCommandProcessor();
        
        // Initialize document store
        initializeDocumentStore();
        
        console.log('🚀 Cognitive Canvas initialized - targeting <8ms response times');
        
      } catch (error) {
        console.error('Failed to initialize core systems:', error);
      }
    };

    initializeSystems();

    // Cleanup on unmount
    return () => {
      destroyRenderEngine();
      destroyInputProcessor();
      destroyCommandProcessor();
      destroyPerformanceMonitor();
    };
  }, []);

  // Performance monitoring and alerts
  useEffect(() => {
    const monitor = performanceMonitor.current;
    
    // Check performance every second
    const performanceCheck = setInterval(() => {
      const metrics = monitor.getMetrics(60); // Last 60 frames
      const alerts = monitor.getAlerts(5); // Last 5 alerts
      
      // Log performance violations
      alerts.forEach(alert => {
        if (alert.severity === 'critical') {
          console.error(`🔥 Critical Performance Issue: ${alert.message}`);
        }
      });
      
      // Auto-adjust performance budget if consistently under budget
      const avgFrameTime = monitor.getAverageFrameTime(60);
      if (avgFrameTime < 5 && metrics.length >= 60) {
        // System is performing well, could potentially increase workload
        console.log(`✅ Performance excellent: ${avgFrameTime.toFixed(2)}ms avg frame time`);
      }
      
    }, 1000);

    return () => clearInterval(performanceCheck);
  }, []);

  return (
    <div 
      ref={appContainerRef}
      className="h-screen w-screen overflow-hidden bg-white flex flex-col"
      style={{
        // Enable GPU acceleration for the entire app
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      {/* Hidden canvas for GPU rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-0"
        style={{ zIndex: -1 }}
      />

      {/* Error Boundary for the entire app */}
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error, errorInfo) => {
          console.error('App Error:', error, errorInfo);
          // Report to error tracking service
        }}
        onReset={() => {
          // Reset application state
          window.location.reload();
        }}
      >
        {/* Workspace Management */}
        <Suspense fallback={<LoadingFallback message="Loading workspace..." />}>
          <WorkspaceManager className="flex-shrink-0" />
        </Suspense>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingFallback message="Loading editor..." />}>
            <MainEditor />
          </Suspense>
        </div>

        {/* Settings Modal */}
              </ErrorBoundary>

      {/* Performance HUD (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceHUD />
      )}
    </div>
  );
};

// Main editor component that handles active document
const MainEditor: React.FC = () => {
  const activeDocument = useDocumentStore(state => state.getActiveDocument());
  
  if (!activeDocument) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to Cognitive Canvas</h2>
          <p>Create a new document to start writing</p>
        </div>
      </div>
    );
  }

  return (
    <EditorCore 
      documentId={activeDocument.id}
      className="h-full"
    />
  );
};


// Development performance HUD
const PerformanceHUD: React.FC = () => {
  const [metrics, setMetrics] = React.useState<any>(null);
  
  useEffect(() => {
    const monitor = getPerformanceMonitor();
    
    const updateMetrics = () => {
      const currentMetrics = monitor.getMetrics(1)[0];
      const averageFrameTime = monitor.getAverageFrameTime(60);
      const score = monitor.getPerformanceScore();
      
      setMetrics({
        frameTime: currentMetrics?.frameTime || 0,
        averageFrameTime,
        score,
        alerts: monitor.getAlerts(3)
      });
    };
    
    const interval = setInterval(updateMetrics, 100);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded text-xs font-mono z-50">
      <div>Frame: {metrics.frameTime.toFixed(1)}ms</div>
      <div>Avg: {metrics.averageFrameTime.toFixed(1)}ms</div>
      <div>Score: {metrics.score}/100</div>
      {metrics.alerts.length > 0 && (
        <div className="text-red-400">⚠ {metrics.alerts.length} alerts</div>
      )}
    </div>
  );
};

export default App;