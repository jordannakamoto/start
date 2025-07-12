import { invoke } from '@tauri-apps/api/core';

export interface Shortcuts {
  command_palette: string;
}

class ShortcutsService {
  async getShortcuts(): Promise<Shortcuts> {
    try {
      return await invoke<Shortcuts>('get_shortcuts');
    } catch (error) {
      console.error('Failed to get shortcuts:', error);
      throw error;
    }
  }
}

export const shortcutsService = new ShortcutsService();
