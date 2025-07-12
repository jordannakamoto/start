use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use std::path::PathBuf;
use crate::config_parser::ConfigParser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub window_decorations: bool,
    pub window_maximized: bool,
    pub window_fullscreen: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            window_decorations: true,
            window_maximized: true,
            window_fullscreen: false,
        }
    }
}

fn get_config_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    Ok(app_data_dir.join("settings.conf"))
}

pub fn load_settings(app_handle: &AppHandle) -> Result<Settings, String> {
    let config_path = get_config_path(app_handle)?;
    let config_path_str = config_path.to_str()
        .ok_or("Invalid config path")?;
    
    let mut parser = ConfigParser::new(config_path_str);
    parser.load()?;
    
    let settings = Settings {
        window_decorations: parser.get_bool("window_decorations").unwrap_or(true),
        window_maximized: parser.get_bool("window_maximized").unwrap_or(true),
        window_fullscreen: parser.get_bool("window_fullscreen").unwrap_or(false),
    };
    
    Ok(settings)
}

pub fn save_settings(app_handle: &AppHandle, settings: &Settings) -> Result<(), String> {
    let config_path = get_config_path(app_handle)?;
    let config_path_str = config_path.to_str()
        .ok_or("Invalid config path")?;
    
    let mut parser = ConfigParser::new(config_path_str);
    parser.load()?; // Load existing config to preserve comments
    
    // Update values
    parser.set_bool("window_decorations", settings.window_decorations);
    parser.set_bool("window_maximized", settings.window_maximized);
    parser.set_bool("window_fullscreen", settings.window_fullscreen);
    
    // Set comments if they don't exist
    parser.set_comment("window_decorations", "Show native window title bar and decorations");
    parser.set_comment("window_maximized", "Start window in maximized state");
    parser.set_comment("window_fullscreen", "Start window in fullscreen mode (overrides maximized)");
    
    parser.save()?;
    Ok(())
}

pub fn apply_window_settings(app_handle: &AppHandle, settings: &Settings) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        // Apply decorations
        window.set_decorations(settings.window_decorations).map_err(|e| e.to_string())?;
        
        // Apply fullscreen or maximized state
        if settings.window_fullscreen {
            window.set_fullscreen(true).map_err(|e| e.to_string())?;
        } else {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
            if settings.window_maximized {
                window.maximize().map_err(|e| e.to_string())?;
            } else {
                window.unmaximize().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}