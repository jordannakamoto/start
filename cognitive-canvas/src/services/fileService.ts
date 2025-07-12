import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export interface DocumentData {
  id: string;
  title: string;
  content: string;
  file_path?: string;
}

class FileService {
  async saveDocument(document: DocumentData, path?: string): Promise<string> {
    try {
      console.log('saveDocument called with:', { document, path });
      let filePath = path || document.file_path;
      
      if (!filePath) {
        console.log('No file path, showing save dialog...');
        // Show save dialog if no path is provided
        const savePath = await save({
          filters: [{
            name: 'Canvas Files',
            extensions: ['canvas', 'txt']
          }],
          defaultPath: `${document.title}.canvas`
        });

        if (savePath === null) {
          throw new Error('Save cancelled by user');
        }
        filePath = savePath;
        
        console.log('Save dialog result:', filePath);
        
        if (!filePath) {
          throw new Error('Save cancelled by user');
        }
      }

      const result = await invoke<string>('save_document', { 
        document: {
          id: document.id,
          title: document.title,
          content: document.content,
          file_path: filePath
        }
      });
      
      return result;
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  }

  async loadDocument(): Promise<DocumentData> {
    try {
      console.log('loadDocument called, showing open dialog...');
      // Show open dialog
      const filePath = await open({
        filters: [{
          name: 'Canvas Files',
          extensions: ['canvas', 'txt']
        }],
        multiple: false
      });
      
      console.log('Open dialog result:', filePath);
      
      if (!filePath || Array.isArray(filePath)) {
        throw new Error('No file selected or invalid selection');
      }

      const result = await invoke<DocumentData>('load_document', { 
        path: filePath 
      });
      
      return result;
    } catch (error) {
      console.error('Load error:', error);
      throw error;
    }
  }

  async saveFile(path: string, contents: string): Promise<void> {
    try {
      await invoke('save_file', { path, contents });
    } catch (error) {
      console.error('Save file error:', error);
      throw error;
    }
  }

  async loadFile(path: string): Promise<string> {
    try {
      return await invoke<string>('load_file', { path });
    } catch (error) {
      console.error('Load file error:', error);
      throw error;
    }
  }
}

export const fileService = new FileService();