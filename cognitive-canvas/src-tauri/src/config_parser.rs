use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ConfigParser {
    data: HashMap<String, String>,
    comments: HashMap<String, String>,
    file_path: String,
}

impl ConfigParser {
    pub fn new(file_path: &str) -> Self {
        Self {
            data: HashMap::new(),
            comments: HashMap::new(),
            file_path: file_path.to_string(),
        }
    }

    pub fn load(&mut self) -> Result<(), String> {
        if !Path::new(&self.file_path).exists() {
            // Create default config file if it doesn't exist
            self.create_default_config()?;
        }

        let content = fs::read_to_string(&self.file_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        self.parse_content(&content)?;
        Ok(())
    }

    pub fn save(&self) -> Result<(), String> {
        let content = self.generate_content();
        fs::write(&self.file_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        Ok(())
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.data.get(key)
    }

    pub fn get_bool(&self, key: &str) -> Option<bool> {
        self.data.get(key).and_then(|v| match v.to_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => Some(true),
            "false" | "0" | "no" | "off" => Some(false),
            _ => None,
        })
    }

    pub fn set(&mut self, key: &str, value: &str) {
        self.data.insert(key.to_string(), value.to_string());
    }

    pub fn set_bool(&mut self, key: &str, value: bool) {
        self.data.insert(key.to_string(), value.to_string());
    }

    pub fn set_comment(&mut self, key: &str, comment: &str) {
        self.comments.insert(key.to_string(), comment.to_string());
    }

    fn parse_content(&mut self, content: &str) -> Result<(), String> {
        self.data.clear();
        self.comments.clear();

        for line in content.lines() {
            let trimmed = line.trim();
            
            // Skip empty lines and comment-only lines
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            // Handle key=value with optional inline comment
            if let Some(equals_pos) = trimmed.find('=') {
                let key = trimmed[..equals_pos].trim().to_string();
                let rest = &trimmed[equals_pos + 1..];
                
                // Split value and comment
                let (value, comment) = if let Some(hash_pos) = rest.find('#') {
                    let value = rest[..hash_pos].trim();
                    let comment = rest[hash_pos + 1..].trim();
                    (value, Some(comment))
                } else {
                    (rest.trim(), None)
                };

                // Remove quotes if present
                let value = if (value.starts_with('"') && value.ends_with('"')) ||
                             (value.starts_with('\'') && value.ends_with('\'')) {
                    &value[1..value.len()-1]
                } else {
                    value
                };

                self.data.insert(key.clone(), value.to_string());
                
                if let Some(comment_text) = comment {
                    self.comments.insert(key, comment_text.to_string());
                }
            }
        }

        Ok(())
    }

    fn generate_content(&self) -> String {
        let mut lines = Vec::new();
        
        // Add header comment
        lines.push("# Cognitive Canvas Configuration".to_string());
        lines.push("# This file stores user preferences in a simple key=value format".to_string());
        lines.push("# Lines starting with # are comments and will be ignored".to_string());
        lines.push("".to_string());

        // Sort keys for consistent output
        let mut keys: Vec<_> = self.data.keys().collect();
        keys.sort();

        for key in keys {
            if let Some(value) = self.data.get(key) {
                let comment = self.comments.get(key);
                
                if let Some(comment_text) = comment {
                    lines.push(format!("{}={} # {}", key, value, comment_text));
                } else {
                    lines.push(format!("{}={}", key, value));
                }
            }
        }

        lines.join("\n")
    }

    fn create_default_config(&mut self) -> Result<(), String> {
        // Set default values with comments
        self.set_bool("window_decorations", true);
        self.set_comment("window_decorations", "Show native window title bar and decorations");
        
        self.set_bool("window_maximized", true);
        self.set_comment("window_maximized", "Start window in maximized state");
        
        self.set_bool("window_fullscreen", false);
        self.set_comment("window_fullscreen", "Start window in fullscreen mode (overrides maximized)");

        self.save()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::env;

    #[test]
    fn test_config_parser() {
        let temp_file = env::temp_dir().join("test_config.conf");
        let temp_path = temp_file.to_str().unwrap();
        
        // Clean up any existing file
        let _ = fs::remove_file(&temp_file);
        
        let mut parser = ConfigParser::new(temp_path);
        
        // Test loading (should create default)
        assert!(parser.load().is_ok());
        
        // Test getting values
        assert_eq!(parser.get_bool("window_decorations"), Some(true));
        assert_eq!(parser.get_bool("window_maximized"), Some(true));
        assert_eq!(parser.get_bool("window_fullscreen"), Some(false));
        
        // Test setting values
        parser.set_bool("window_fullscreen", true);
        assert!(parser.save().is_ok());
        
        // Test reloading
        let mut parser2 = ConfigParser::new(temp_path);
        assert!(parser2.load().is_ok());
        assert_eq!(parser2.get_bool("window_fullscreen"), Some(true));
        
        // Clean up
        let _ = fs::remove_file(&temp_file);
    }
}