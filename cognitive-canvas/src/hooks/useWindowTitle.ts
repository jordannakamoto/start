import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useWindowTitle(title: string, isDirty: boolean = false) {
  useEffect(() => {
    const updateTitle = async () => {
      const appWindow = getCurrentWindow();
      const fullTitle = isDirty ? `${title} • Cognitive Canvas` : `${title} - Cognitive Canvas`;
      await appWindow.setTitle(fullTitle);
    };

    updateTitle();
  }, [title, isDirty]);
}