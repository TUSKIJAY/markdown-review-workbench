import type { LoadedDocument, SourceFormat } from '../types';

const recentKey = 'linjing-md-review:recent-v1';
const maxEntries = 12;

export interface RecentEntry {
  filePath: string;
  fileName: string;
  sourceFormat: SourceFormat;
  contentHash: string;
  lastOpenedAt: string;
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.filePath === 'string' &&
    typeof entry.fileName === 'string' &&
    (entry.sourceFormat === 'markdown' || entry.sourceFormat === 'docx') &&
    typeof entry.contentHash === 'string' &&
    typeof entry.lastOpenedAt === 'string'
  );
}

export function loadRecentEntries(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(recentKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEntry);
  } catch {
    return [];
  }
}

function persist(entries: RecentEntry[]) {
  try {
    localStorage.setItem(recentKey, JSON.stringify(entries.slice(0, maxEntries)));
  } catch {
    /* quota or disabled — ignore */
  }
}

export function recordRecent(doc: LoadedDocument): RecentEntry[] {
  if (!doc.filePath) return loadRecentEntries();
  const next: RecentEntry = {
    filePath: doc.filePath,
    fileName: doc.fileName,
    sourceFormat: doc.sourceFormat,
    contentHash: doc.contentHash,
    lastOpenedAt: new Date().toISOString(),
  };
  const existing = loadRecentEntries().filter((entry) => entry.filePath !== doc.filePath);
  const merged = [next, ...existing].slice(0, maxEntries);
  persist(merged);
  return merged;
}

export function removeRecent(filePath: string): RecentEntry[] {
  const next = loadRecentEntries().filter((entry) => entry.filePath !== filePath);
  persist(next);
  return next;
}

export function clearRecent(): RecentEntry[] {
  persist([]);
  return [];
}

export function formatRelativeTime(iso: string, now = new Date()) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const year = then.getFullYear();
  const month = String(then.getMonth() + 1).padStart(2, '0');
  const day = String(then.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
