import type { LoadedDocument, ReviewNote } from '../types';

const prefix = 'linjing-md-review';

// 存储键只用文件身份（桌面模式用真实路径，浏览器退化为文件名），不含内容指纹。
// 这样原文内容变化不会改变键，历史标注不会因指纹漂移而被"丢失"（实为找不到旧键）。
export function buildStorageKey(doc: Pick<LoadedDocument, 'filePath' | 'fileName'>) {
  return `${prefix}:${doc.filePath || doc.fileName}`;
}

interface StoredNotesRecord {
  version: 1;
  contentHash: string;
  notes: ReviewNote[];
}

export interface LoadedNotes {
  notes: ReviewNote[];
  // 标注保存时所基于的内容指纹。null 表示旧格式或无记录，无法判断原文是否已漂移。
  storedHash: string | null;
}

export function loadStoredNotes(key: string): LoadedNotes {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { notes: [], storedHash: null };
    const parsed = JSON.parse(raw);
    // 兼容旧格式：早期版本直接存 ReviewNote[]，无内容指纹。
    if (Array.isArray(parsed)) {
      return { notes: parsed as ReviewNote[], storedHash: null };
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as StoredNotesRecord).notes)) {
      const record = parsed as StoredNotesRecord;
      return {
        notes: record.notes,
        storedHash: typeof record.contentHash === 'string' ? record.contentHash : null,
      };
    }
    return { notes: [], storedHash: null };
  } catch {
    return { notes: [], storedHash: null };
  }
}

export function storeNotes(key: string, contentHash: string, notes: ReviewNote[]) {
  const record: StoredNotesRecord = { version: 1, contentHash, notes };
  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // localStorage 不可用或超额（隐私模式 / quota）。标注仍在内存中，放弃本次持久化即可。
  }
}

// ---- 桌面模式 sidecar 同步基线 ----
// 记录工作台上次成功写出的 .ai-notes.json / .review.md 内容指纹，
// 用于在自动同步前判断磁盘上的 sidecar 是否被外部（人或 Agent）改动过，避免静默覆盖。
export interface SyncBaseline {
  aiHash: string;
  reviewHash: string;
  updatedAt: string;
}

function baselineKey(filePath: string) {
  return `${prefix}:sync-baseline:${filePath}`;
}

export function loadSyncBaseline(filePath: string): SyncBaseline | null {
  try {
    const raw = localStorage.getItem(baselineKey(filePath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncBaseline>;
    if (parsed && typeof parsed.aiHash === 'string' && typeof parsed.reviewHash === 'string') {
      return {
        aiHash: parsed.aiHash,
        reviewHash: parsed.reviewHash,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function storeSyncBaseline(filePath: string, aiHash: string, reviewHash: string) {
  const baseline: SyncBaseline = { aiHash, reviewHash, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(baselineKey(filePath), JSON.stringify(baseline));
  } catch {
    // 同上，基线持久化失败不影响主流程。
  }
}
