use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use std::path::PathBuf;
use crate::config_parser::ConfigParser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shortcuts {
    pub command_palette: String,
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            command_palette: "Cmd+P".to_string(),
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
    
    Ok(app_data_dir.join("shortcuts.conf"))
}

pub fn load_shortcuts(app_handle: &AppHandle) -> Result<Shortcuts, String> {
    let config_path = get_config_path(app_handle)?;
    let config_path_str = config_path.to_str()
        .ok_or("Invalid config path")?;
    
    let mut parser = ConfigParser::new(config_path_str);
    parser.load()?;
    
    let mut command_palette = parser.get_str("command_palette").unwrap_or(&"Cmd+P".to_string()).to_string();
    if command_palette.trim().is_empty() {
        command_palette = "Cmd+P".to_string();
    }
    let shortcuts = Shortcuts {
        command_palette,
    };
    
    Ok(shortcuts)
}

pub fn save_shortcuts(app_handle: &AppHandle, shortcuts: &Shortcuts) -> Result<(), String> {
    let config_path = get_config_path(app_handle)?;
    let config_path_str = config_path.to_str()
        .ok_or("Invalid config path")?;
    
    let mut parser = ConfigParser::new(config_path_str);
    parser.load()?; // Load existing config to preserve comments
    
    // Update values
    parser.set_str("command_palette", &shortcuts.command_palette);
    
    // Set comments if they don't exist
    parser.set_comment("command_palette", "Open the command palette");
    
    parser.save()?;
    Ok(())
}
