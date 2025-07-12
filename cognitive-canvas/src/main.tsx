import App from "./App";
import React from "react";
import ReactDOM from "react-dom/client";
import { initializeContentTypes } from "./content/registry";

// Show window as soon as Tauri API is available
async function showWindowWhenTauriReady() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('show_window_when_ready');
    console.log('🚀 Window shown immediately when Tauri API ready');
  } catch (error) {
    console.log('Not running in Tauri or window show command unavailable:', error);
  }
}

// Initialize content types
initializeContentTypes();

// Add debug functions to global scope for development
if (typeof window !== 'undefined') {
  (window as any).clearAppStorage = () => {
    localStorage.removeItem('cognitive-canvas-state');
    localStorage.clear();
    location.reload();
  };
  
  console.log('🛠️ Debug: Use clearAppStorage() in console to clear all data');
}

// Call immediately since main.tsx only loads when Tauri API is ready
showWindowWhenTauriReady();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
