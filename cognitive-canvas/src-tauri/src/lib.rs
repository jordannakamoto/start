use serde::{Deserialize, Serialize};
use std::path::Path;

mod settings_manager;
mod shortcuts_manager;
mod config_parser;

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentData {
    pub id: String,
    pub title: String,
    pub content: String,
    pub file_path: Option<String>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn ping_backend(name: String) -> Result<String, String> {
    Ok(format!("GOD MODE: Online. Acknowledged input: {}. Stand by.", name))
}

#[tauri::command]
async fn save_file(path: String, contents: String) -> Result<(), String> {
    match tokio::fs::write(&path, contents).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to save file: {}", e)),
    }
}

#[tauri::command]
async fn load_file(path: String) -> Result<String, String> {
    match tokio::fs::read_to_string(&path).await {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to load file: {}", e)),
    }
}

#[tauri::command]
async fn save_document(document: DocumentData) -> Result<String, String> {
    let file_path = match &document.file_path {
        Some(path) => path.clone(),
        None => {
            // Generate a default filename
            let sanitized_title = document.title
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
                .collect::<String>()
                .replace(' ', "_");
            format!("{}.canvas", sanitized_title)
        }
    };

    match tokio::fs::write(&file_path, &document.content).await {
        Ok(_) => Ok(file_path),
        Err(e) => Err(format!("Failed to save document: {}", e)),
    }
}

#[tauri::command]
async fn load_document(path: String) -> Result<DocumentData, String> {
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(content) => content,
        Err(e) => return Err(format!("Failed to load document: {}", e)),
    };

    let file_name = Path::new(&path)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled")
        .to_string();

    Ok(DocumentData {
        id: format!("doc-{}", chrono::Utc::now().timestamp_millis()),
        title: file_name,
        content,
        file_path: Some(path),
    })
}

#[tauri::command]
fn get_settings(app_handle: tauri::AppHandle) -> Result<settings_manager::Settings, String> {
    settings_manager::load_settings(&app_handle)
}

#[tauri::command]
fn set_window_decorations(app_handle: tauri::AppHandle, decorations: bool) -> Result<(), String> {
    let mut settings = settings_manager::load_settings(&app_handle)?;
    
    settings.window_decorations = decorations;
    
    // Save the new settings
    settings_manager::save_settings(&app_handle, &settings)?;
    
    // Apply the window decorations immediately
    settings_manager::apply_window_settings(&app_handle, &settings)?;
    
    Ok(())
}

#[tauri::command]
fn set_window_maximized(app_handle: tauri::AppHandle, maximized: bool) -> Result<(), String> {
    let mut settings = settings_manager::load_settings(&app_handle)?;
    
    settings.window_maximized = maximized;
    
    // Save the new settings
    settings_manager::save_settings(&app_handle, &settings)?;
    
    // Apply the window settings immediately
    settings_manager::apply_window_settings(&app_handle, &settings)?;
    
    Ok(())
}

#[tauri::command]
fn set_window_fullscreen(app_handle: tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    let mut settings = settings_manager::load_settings(&app_handle)?;
    
    settings.window_fullscreen = fullscreen;
    
    // Save the new settings
    settings_manager::save_settings(&app_handle, &settings)?;
    
    // Apply the window settings immediately
    settings_manager::apply_window_settings(&app_handle, &settings)?;
    
    Ok(())
}

#[tauri::command]
fn get_shortcuts(app_handle: tauri::AppHandle) -> Result<shortcuts_manager::Shortcuts, String> {
    shortcuts_manager::load_shortcuts(&app_handle)
}

#[tauri::command]
fn get_config_file_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    let config_path = app_data_dir.join("settings.conf");
    config_path.to_str()
        .ok_or("Invalid config path".to_string())
        .map(|s| s.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Ok(settings) = settings_manager::load_settings(&app_handle) {
                let _ = settings_manager::apply_window_settings(&app_handle, &settings);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            ping_backend, 
            save_file, 
            load_file, 
            save_document, 
            load_document,
            get_settings,
            get_shortcuts,
            set_window_decorations,
            set_window_maximized,
            set_window_fullscreen,
            get_config_file_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
