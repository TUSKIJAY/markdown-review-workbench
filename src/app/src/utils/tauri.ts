import { invoke } from '@tauri-apps/api/core';
import type { FolderMarkdownFile, LoadedDocument } from '../types';

export interface OpenedFolder {
  folderPath: string;
  files: FolderMarkdownFile[];
}

export interface WriteReviewFilesResult {
  aiNotesPath: string;
  reviewPath: string;
  updatedAt: string;
}

export interface LoadedBinaryDocument {
  fileName: string;
  filePath: string;
  sourceFormat: 'docx';
  bytesBase64: string;
}

export interface LoadedSourceDocument {
  fileName: string;
  filePath: string;
  sourceFormat: 'markdown' | 'docx';
  markdown?: string;
  contentHash?: string;
  totalLines?: number;
  bytesBase64?: string;
  conversionMessages: string[];
}

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export function isTauriCancel(error: unknown) {
  return typeof error === 'string' && error === 'cancelled';
}

export function openMarkdownFileWithTauri() {
  return invoke<LoadedDocument>('open_markdown_file');
}

export function openDocumentFileWithTauri() {
  return invoke<LoadedSourceDocument>('open_document_file');
}

export function readDocumentFileWithTauri(path: string) {
  return invoke<LoadedSourceDocument>('read_document_file', { path });
}

export function readMarkdownFileWithTauri(path: string) {
  return invoke<LoadedDocument>('read_markdown_file', { path });
}

export function openWordFileWithTauri() {
  return invoke<LoadedBinaryDocument>('open_word_file');
}

export function readWordFileWithTauri(path: string) {
  return invoke<LoadedBinaryDocument>('read_word_file', { path });
}

export function openMarkdownFolderWithTauri() {
  return invoke<OpenedFolder>('open_markdown_folder');
}

export function listMarkdownFilesWithTauri(folderPath: string) {
  return invoke<FolderMarkdownFile[]>('list_markdown_files', { folderPath });
}

export function writeReviewFilesWithTauri(
  sourcePath: string,
  aiNotesJson: string,
  reviewMarkdown: string,
) {
  return invoke<WriteReviewFilesResult>('write_review_files', {
    sourcePath,
    aiNotesJson,
    reviewMarkdown,
  });
}
