import { useEffect } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useBeforeUnload() {
  const { documents } = useDocumentStore();

  useEffect(() => {
    const setupCloseHandler = async () => {
      const appWindow = getCurrentWindow();
      
      const unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
        const dirtyDocuments = documents.filter(doc => doc.isDirty);
        
        if (dirtyDocuments.length > 0) {
          // Prevent the window from closing immediately
          event.preventDefault();
          
          // Show confirmation dialog
          const shouldClose = await showUnsavedChangesDialog(dirtyDocuments.length);
          
          if (shouldClose) {
            // User confirmed, allow the window to close
            await appWindow.close();
          }
        }
      });

      return unlistenCloseRequested;
    };

    let cleanup: (() => void) | undefined;
    setupCloseHandler().then(unlistenFn => {
      cleanup = unlistenFn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [documents]);
}

async function showUnsavedChangesDialog(dirtyCount: number): Promise<boolean> {
  // For now, use browser confirm dialog
  // In a real app, you'd use Tauri's dialog API
  const message = dirtyCount === 1 
    ? 'You have 1 unsaved document. Do you want to close without saving?'
    : `You have ${dirtyCount} unsaved documents. Do you want to close without saving?`;
  
  return confirm(message);
}