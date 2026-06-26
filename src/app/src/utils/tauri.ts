import { invoke } from '@tauri-apps/api/core';
import type { FolderMarkdownFile } from '../types';

export interface OpenedFolder {
  folderPath: string;
  files: FolderMarkdownFile[];
}

export interface WriteReviewFilesResult {
  aiNotesPath: string;
  reviewPath: string;
  updatedAt: string;
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

// 桌面模式下原文目录已存在的 sidecar 内容；文件不存在时对应字段为 null。
export interface ExistingReviewFiles {
  aiNotes: string | null;
  review: string | null;
}

export interface MarkdownImageAsset {
  dataUrl: string;
}

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export function isTauriCancel(error: unknown) {
  return typeof error === 'string' && error === 'cancelled';
}

export function openDocumentFileWithTauri() {
  return invoke<LoadedSourceDocument>('open_document_file');
}

export function readDocumentFileWithTauri(path: string) {
  return invoke<LoadedSourceDocument>('read_document_file', { path });
}

export function openMarkdownFolderWithTauri() {
  return invoke<OpenedFolder>('open_markdown_folder');
}

export function readReviewFilesWithTauri(sourcePath: string) {
  return invoke<ExistingReviewFiles>('read_review_files', { sourcePath });
}

export function readMarkdownImageWithTauri(sourcePath: string, imagePath: string) {
  return invoke<MarkdownImageAsset>('read_markdown_image', { sourcePath, imagePath });
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
