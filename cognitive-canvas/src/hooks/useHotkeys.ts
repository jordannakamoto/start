
import { useEffect } from 'react';

type HotkeyCallback = (event: KeyboardEvent) => void;

interface Hotkey {
  keys: string[];
  callback: HotkeyCallback;
  preventDefault?: boolean;
}

const useHotkeys = (hotkeys: Hotkey[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingHotkey = hotkeys.find(hotkey => 
        hotkey.keys.every(key => {
          if (key.toLowerCase() === 'cmd') return event.metaKey;
          if (key.toLowerCase() === 'ctrl') return event.ctrlKey;
          if (key.toLowerCase() === 'shift') return event.shiftKey;
          if (key.toLowerCase() === 'alt') return event.altKey;
          return event.key.toLowerCase() === key.toLowerCase();
        })
      );

      if (matchingHotkey) {
        if (matchingHotkey.preventDefault) {
          event.preventDefault();
        }
        matchingHotkey.callback(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeys]);
};

export default useHotkeys;
