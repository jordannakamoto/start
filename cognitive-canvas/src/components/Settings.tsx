import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, X, ExternalLink } from 'lucide-react';

interface Settings {
  window_decorations: boolean;
  window_maximized: boolean;
  window_fullscreen: boolean;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const currentSettings = await invoke<Settings>('get_settings');
      setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWindowDecorationsChange = async (checked: boolean) => {
    try {
      await invoke('set_window_decorations', { decorations: checked });
      setSettings(prev => prev ? { ...prev, window_decorations: checked } : null);
    } catch (error) {
      console.error('Failed to update window decorations:', error);
    }
  };

  const handleWindowMaximizedChange = async (checked: boolean) => {
    try {
      await invoke('set_window_maximized', { maximized: checked });
      setSettings(prev => prev ? { ...prev, window_maximized: checked } : null);
    } catch (error) {
      console.error('Failed to update window maximized:', error);
    }
  };

  const handleWindowFullscreenChange = async (checked: boolean) => {
    try {
      await invoke('set_window_fullscreen', { fullscreen: checked });
      setSettings(prev => prev ? { ...prev, window_fullscreen: checked } : null);
    } catch (error) {
      console.error('Failed to update window fullscreen:', error);
    }
  };

  const openConfigFile = async () => {
    try {
      const configPath = await invoke<string>('get_config_file_path');
      // Open the config file in the default editor using shell plugin
      const command = Command.create('open', [configPath]);
      await command.execute();
    } catch (error) {
      console.error('Failed to open config file:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            <CardTitle>Preferences</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Window</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="window-decorations">Show Window Title Bar</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle the native window title bar. Hold Cmd+drag to move window when hidden.
                  </p>
                </div>
                <Switch
                  id="window-decorations"
                  checked={settings?.window_decorations ?? true}
                  onCheckedChange={handleWindowDecorationsChange}
                  disabled={loading || !settings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="window-maximized">Start Maximized</Label>
                  <p className="text-sm text-muted-foreground">
                    Start the application in a maximized window state
                  </p>
                </div>
                <Switch
                  id="window-maximized"
                  checked={settings?.window_maximized ?? true}
                  onCheckedChange={handleWindowMaximizedChange}
                  disabled={loading || !settings || (settings?.window_fullscreen ?? false)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="window-fullscreen">Start Fullscreen</Label>
                  <p className="text-sm text-muted-foreground">
                    Start the application in fullscreen mode (overrides maximized)
                  </p>
                </div>
                <Switch
                  id="window-fullscreen"
                  checked={settings?.window_fullscreen ?? false}
                  onCheckedChange={handleWindowFullscreenChange}
                  disabled={loading || !settings}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Configuration File</h3>
                <p className="text-sm text-muted-foreground">
                  Advanced settings can be modified directly in the config file
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openConfigFile}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Edit Config
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd+,</kbd> to open preferences
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}