import { create } from 'zustand';

interface CommandStore {
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  toggleCommandPalette: () => void;
}

export const useCommandStore = create<CommandStore>((set) => ({
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
}));
