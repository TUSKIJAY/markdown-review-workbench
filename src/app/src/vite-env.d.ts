/// <reference types="vite/client" />

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface Window {
  __TAURI_INTERNALS__?: unknown;
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle & {
    createWritable(): Promise<{
      write(data: Blob | string): Promise<void>;
      close(): Promise<void>;
    }>;
  }>;
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}
