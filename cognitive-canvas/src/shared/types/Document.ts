/**
 * Document-related type definitions
 */

export interface DocumentMetadata {
  id: string;
  title: string;
  created: number;
  modified: number;
  size: number;
  checksum: string;
  version: number;
}

export interface DocumentState {
  id: string;
  jsonState: string;
  isDirty: boolean;
  isLoading: boolean;
  lastSaved: number;
}

export interface DocumentView {
  id: string;
  scrollTop: number;
  cursorPosition: number;
  selection: DocumentSelection | null;
  isActive: boolean;
  zoom: number;
}

export interface DocumentSelection {
  start: number;
  end: number;
  direction: 'forward' | 'backward';
}

export interface DocumentSnapshot {
  id: string;
  timestamp: number;
  state: string;
  description: string;
}

export type DocumentEventType = 
  | 'created'
  | 'updated' 
  | 'saved'
  | 'loaded'
  | 'deleted'
  | 'renamed'
  | 'duplicated';

export interface DocumentEvent {
  type: DocumentEventType;
  documentId: string;
  timestamp: number;
  data?: any;
}