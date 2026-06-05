import type { ReviewNote } from '../types';

const prefix = 'linjing-md-review';

export function buildStorageKey(fileName: string, contentHash: string) {
  return `${prefix}:${fileName}:${contentHash}`;
}

export function loadStoredNotes(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReviewNote[]) : [];
  } catch {
    return [];
  }
}

export function storeNotes(key: string, notes: ReviewNote[]) {
  localStorage.setItem(key, JSON.stringify(notes));
}
