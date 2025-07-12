// State Persistence Web Worker
// Handles localStorage operations off the main thread

let pendingSave = null;

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'SAVE_STATE':
      handleSaveState(data);
      break;
      
    case 'LOAD_STATE':
      handleLoadState();
      break;
      
    case 'CLEAR_STATE':
      handleClearState();
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};

function handleSaveState(state) {
  try {
    // Cancel any pending save
    if (pendingSave) {
      clearTimeout(pendingSave);
    }
    
    // Immediate save (non-blocking since we're in worker)
    const serialized = JSON.stringify(state);
    
    // Use postMessage to send to main thread for localStorage
    // (Workers can't access localStorage directly)
    self.postMessage({
      type: 'SAVE_TO_STORAGE',
      data: {
        key: 'cognitive-canvas-display',
        value: serialized
      }
    });
    
    // Confirm save
    self.postMessage({
      type: 'SAVE_COMPLETE',
      data: { timestamp: Date.now() }
    });
    
  } catch (error) {
    self.postMessage({
      type: 'SAVE_ERROR',
      data: { error: error.message }
    });
  }
}

function handleLoadState() {
  try {
    // Request state from main thread
    self.postMessage({
      type: 'LOAD_FROM_STORAGE',
      data: { key: 'cognitive-canvas-display' }
    });
  } catch (error) {
    self.postMessage({
      type: 'LOAD_ERROR',
      data: { error: error.message }
    });
  }
}

function handleClearState() {
  try {
    self.postMessage({
      type: 'CLEAR_FROM_STORAGE',
      data: { key: 'cognitive-canvas-display' }
    });
    
    self.postMessage({
      type: 'CLEAR_COMPLETE',
      data: { timestamp: Date.now() }
    });
  } catch (error) {
    self.postMessage({
      type: 'CLEAR_ERROR',
      data: { error: error.message }
    });
  }
}

// Keep worker alive
self.postMessage({
  type: 'WORKER_READY',
  data: { timestamp: Date.now() }
});