import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useCommandDrag() {
  useEffect(() => {
    let isDragging = false;

    const handleMouseDown = async (e: MouseEvent) => {
      // Only enable dragging when Command (Meta) key is held
      if (e.metaKey) {
        isDragging = true;
        const window = getCurrentWindow();
        await window.startDragging();
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Stop dragging if Command key is released
      if (e.key === 'Meta') {
        isDragging = false;
      }
    };

    // Add event listeners to the entire document
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}