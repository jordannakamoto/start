import { Document } from '@/store/documentStore';

interface AppState {
  documents: Document[];
  activeTabId: string | null;
}

const STATE_KEY = 'cognitive-canvas-state';

export class StateService {
  static async saveState(state: AppState): Promise<void> {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  static async loadState(): Promise<AppState | null> {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Failed to load state:', error);
      return null;
    }
  }

  static async clearState(): Promise<void> {
    try {
      localStorage.removeItem(STATE_KEY);
    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }
}