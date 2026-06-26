import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Code2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  History,
  ListTree,
  PanelRightOpen,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ExpectedAction,
  FolderMarkdownFile,
  LoadedDocument,
  MarkdownBlock,
  NotePriority,
  NoteStatus,
  ReviewMode,
  ReviewNote,
  RevisionType,
} from './types';
import {
  createContentHash,
  extractMarkdownImageSources,
  getBaseName,
  parseMarkdown,
  renderMarkdownHtml,
} from './utils/markdown';
import { buildAgentNotesJson, buildReviewMarkdown, saveTextFile } from './utils/export';
import {
  buildStorageKey,
  loadStoredNotes,
  loadSyncBaseline,
  storeNotes,
  storeSyncBaseline,
} from './utils/storage';
import {
  isTauriCancel,
  isTauriRuntime,
  openDocumentFileWithTauri,
  openMarkdownFolderWithTauri,
  readDocumentFileWithTauri,
  readMarkdownImageWithTauri,
  readReviewFilesWithTauri,
  type LoadedSourceDocument,
  writeReviewFilesWithTauri,
} from './utils/tauri';
import {
  arrayBufferFromBase64,
  convertWordToDocument,
  getSourceFormatFromName,
  isReviewableDocumentName,
} from './utils/word';
import {
  clearRecent,
  formatRelativeTime,
  loadRecentEntries,
  recordRecent,
  removeRecent,
  type RecentEntry,
} from './utils/recent';

// 自动保存与同步的防抖时长（毫秒），集中在此调整，避免魔法数字散落各处。
const AUTOSAVE_DEBOUNCE_MS = 550;
const FILE_SYNC_DEBOUNCE_MS = 850;
const TOAST_DURATION_MS = 2600;
const imagePathSuffixPattern = /[?#].*$/;

const actionOptions: Array<{ value: ExpectedAction; label: string }> = [
  { value: 'rewrite', label: '重写' },
  { value: 'expand', label: '补充' },
  { value: 'tighten', label: '压缩' },
  { value: 'verify', label: '核验' },
  { value: 'format', label: '格式' },
  { value: 'custom', label: '自定义' },
];

const priorityOptions: Array<{ value: NotePriority; label: string }> = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const statusOptions: Array<{ value: NoteStatus; label: string }> = [
  { value: 'todo', label: '待处理' },
  { value: 'draft', label: '草稿' },
  { value: 'reviewed', label: '已复核' },
  { value: 'done', label: '已完成' },
];

const revisionTypeOptions: Array<{ value: RevisionType; label: string }> = [
  { value: 'replace', label: '替换' },
  { value: 'delete', label: '删除' },
  { value: 'insert', label: '插入' },
];

type SelectionRange = NonNullable<ReviewNote['selectionRange']>;
type InspectorExpansion = 'none' | 'excerpt' | 'notes';

const blockTypeLabels: Record<MarkdownBlock['type'], string> = {
  heading: '标题',
  paragraph: '段落',
  list: '列表',
  quote: '引用',
  code: '代码',
  table: '表格',
  rule: '分隔',
};

function formatLineRange(block: Pick<MarkdownBlock, 'startLine' | 'endLine'>, format: 'line' | 'block' = 'line') {
  const unit = format === 'block' ? '块' : '行';
  return block.startLine === block.endLine
    ? `第 ${block.startLine} ${unit}`
    : `第 ${block.startLine}-${block.endLine} ${unit}`;
}

function makeNoteId() {
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isExternalAssetSrc(src: string) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src);
}

function stripImagePathSuffix(src: string) {
  return src.replace(imagePathSuffixPattern, '');
}

function decodeImagePath(src: string) {
  try {
    return decodeURIComponent(stripImagePathSuffix(src));
  } catch {
    return stripImagePathSuffix(src);
  }
}

function normalizePathParts(parts: string[]) {
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!normalized.length) return null;
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized;
}

function resolveBrowserAssetParts(documentPath: string, rootName: string, src: string) {
  const documentParts = documentPath.split('/').filter(Boolean);
  const rootOffset = documentParts[0] === rootName ? 1 : 0;
  const documentDirectory = documentParts.slice(rootOffset, -1);
  const imageParts = decodeImagePath(src).split(/[\\/]+/);
  return normalizePathParts([...documentDirectory, ...imageParts]);
}

function getNoteMode(note: ReviewNote | null | undefined): ReviewMode {
  return note?.mode ?? 'comment';
}

function getNoteAnchorText(note: ReviewNote) {
  return note.selectionRange?.text || note.selectedText || note.originalMarkdown;
}

function noteMatchesSelection(note: ReviewNote, blockId: string, selectionRange: SelectionRange | null) {
  if (note.blockId !== blockId) return false;
  if (!selectionRange) return !note.selectionRange;
  return (
    note.selectionRange?.startOffset === selectionRange.startOffset &&
    note.selectionRange?.endOffset === selectionRange.endOffset &&
    getNoteAnchorText(note) === selectionRange.text
  );
}

function findDraftNote(notes: ReviewNote[], blockId: string, selectionRange: SelectionRange | null, noteId: string | null) {
  if (noteId) {
    const byId = notes.find((note) => note.id === noteId);
    if (byId) return byId;
  }
  return notes.find((note) => noteMatchesSelection(note, blockId, selectionRange)) ?? null;
}

function createSelectionRange(selection: Selection, bodyElement: HTMLElement, selectedText: string): SelectionRange | null {
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!bodyElement.contains(range.commonAncestorContainer)) return null;

  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(bodyElement);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preSelectionRange.toString().length;
  const endOffset = startOffset + selectedText.length;
  if (endOffset <= startOffset) return null;
  return { startOffset, endOffset, text: selectedText };
}

function buildBlockHtmlWithNotes(html: string, blockNotes: ReviewNote[], activeNoteId: string | null) {
  if (!blockNotes.length || typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Array<{ node: Text; start: number; end: number }> = [];
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const length = textNode.data.length;
    textNodes.push({ node: textNode, start: offset, end: offset + length });
    offset += length;
    node = walker.nextNode();
  }

  const ranges = blockNotes
    .map((note) => {
      const selectionRange = note.selectionRange;
      if (selectionRange) {
        return {
          note,
          start: selectionRange.startOffset,
          end: selectionRange.endOffset,
          text: selectionRange.text,
        };
      }
      const selectedText = note.selectedText?.trim();
      if (!selectedText) return null;
      const fullText = template.content.textContent ?? '';
      const start = fullText.indexOf(selectedText);
      if (start < 0) return null;
      return { note, start, end: start + selectedText.length, text: selectedText };
    })
    .filter((range): range is { note: ReviewNote; start: number; end: number; text: string } => Boolean(range))
    .sort((a, b) => a.start - b.start);

  const nonOverlappingRanges: typeof ranges = [];
  let lastEnd = -1;
  for (const range of ranges) {
    if (range.end <= range.start || range.start < lastEnd) continue;
    nonOverlappingRanges.push(range);
    lastEnd = range.end;
  }

  for (const textNode of textNodes) {
    const overlapping = nonOverlappingRanges
      .filter((range) => range.start < textNode.end && range.end > textNode.start)
      .sort((a, b) => a.start - b.start);
    if (!overlapping.length) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const range of overlapping) {
      const localStart = Math.max(0, range.start - textNode.start);
      const localEnd = Math.min(textNode.node.data.length, range.end - textNode.start);
      if (localStart > cursor) {
        fragment.append(textNode.node.data.slice(cursor, localStart));
      }
      const middle = textNode.node.data.slice(localStart, localEnd);
      if (!middle.trim()) {
        fragment.append(middle);
        cursor = localEnd;
        continue;
      }
      const mark = document.createElement('mark');
      const mode = getNoteMode(range.note);
      mark.className = [
        'annotation-mark',
        mode === 'revision' ? `revision-mark revision-${range.note.revisionType ?? 'replace'}` : 'comment-mark',
        range.note.id === activeNoteId ? 'active' : '',
      ]
        .filter(Boolean)
        .join(' ');
      mark.dataset.noteId = range.note.id;
      mark.textContent = middle;
      mark.title = mode === 'revision' ? '修订片段' : '批注片段';

      if (mode === 'revision' && range.note.revisionType !== 'delete' && range.note.replacementText) {
        const insert = document.createElement('span');
        insert.className = 'revision-insert-text';
        insert.textContent = range.note.replacementText;
        mark.appendChild(insert);
      }

      fragment.append(mark);
      cursor = localEnd;
    }
    if (cursor < textNode.node.data.length) {
      fragment.append(textNode.node.data.slice(cursor));
    }
    textNode.node.replaceWith(fragment);
  }

  return template.innerHTML;
}

async function collectDocumentFiles(
  directory: FileSystemDirectoryHandle,
  basePath: string,
  depth = 0,
): Promise<FolderMarkdownFile[]> {
  const files: FolderMarkdownFile[] = [];

  for await (const [, handle] of directory.entries()) {
    if (handle.kind === 'file' && isReviewableDocumentName(handle.name)) {
      files.push({
        name: handle.name,
        path: `${basePath}/${handle.name}`,
        sourceFormat: getSourceFormatFromName(handle.name) ?? 'markdown',
        handle,
      });
    }

    if (handle.kind === 'directory' && depth < 3) {
      const nested = await collectDocumentFiles(handle, `${basePath}/${handle.name}`, depth + 1);
      files.push(...nested);
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const fileSyncTimerRef = useRef<number | null>(null);
  const skipNextFileSyncRef = useRef(false);
  const browserFolderRootRef = useRef<FileSystemDirectoryHandle | null>(null);
  const browserImageUrlsRef = useRef<string[]>([]);

  const [activeDoc, setActiveDoc] = useState<LoadedDocument | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [folderFiles, setFolderFiles] = useState<FolderMarkdownFile[]>([]);
  const [imageSrcMap, setImageSrcMap] = useState<Record<string, string>>({});
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<SelectionRange | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [inspectorExpansion, setInspectorExpansion] = useState<InspectorExpansion>('none');

  const [draftBlockId, setDraftBlockId] = useState<string | null>(null);
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftMode, setDraftMode] = useState<ReviewMode>('comment');
  const [draftRevisionType, setDraftRevisionType] = useState<RevisionType>('replace');
  const [draftReplacementText, setDraftReplacementText] = useState('');
  const [draftAction, setDraftAction] = useState<ExpectedAction>('rewrite');
  const [draftPriority, setDraftPriority] = useState<NotePriority>('medium');
  const [draftStatus, setDraftStatus] = useState<NoteStatus>('todo');
  const [autoSaveState, setAutoSaveState] = useState('选择段落后输入建议');
  const [fileSyncState, setFileSyncState] = useState(
    isTauriRuntime() ? '桌面模式：等待标注' : '浏览器模式：手动导出',
  );
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>(() => loadRecentEntries());
  const autoOpenAttemptedRef = useRef(false);

  const parsed = useMemo(() => {
    if (activeDoc?.sourceFormat === 'docx' && activeDoc.parsed) {
      return activeDoc.parsed;
    }
    return parseMarkdown(markdown);
  }, [activeDoc, markdown]);
  const selectedBlock = parsed.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const isWordDoc = activeDoc?.sourceFormat === 'docx';
  const notesByBlock = useMemo(() => {
    const map = new Map<string, ReviewNote[]>();
    notes.forEach((note) => {
      const blockNotes = map.get(note.blockId) ?? [];
      blockNotes.push(note);
      map.set(note.blockId, blockNotes);
    });
    return map;
  }, [notes]);
  const selectedNote = selectedNoteId ? notes.find((note) => note.id === selectedNoteId) ?? null : null;
  const searchTerm = query.trim().toLowerCase();
  const selectedExcerpt = selectedText || selectedNote?.selectedText || selectedBlock?.plain || selectedBlock?.raw || '';
  const visibleInspectorNotes = inspectorExpansion === 'notes' ? notes : notes.slice(0, 2);
  const resolveMarkdownImageSrc = (src: string) => {
    if (isExternalAssetSrc(src)) return src;
    if (imageSrcMap[src]) return imageSrcMap[src];
    if (!isTauriRuntime() && !browserFolderRootRef.current) {
      return {
        message: '浏览器单文件模式无法读取同目录图片，请用“打开文件夹”打开包含图片的目录。',
      };
    }
    return {
      message: '未找到图片文件，请确认图片在源 Markdown 同目录或子目录中。',
    };
  };

  function revokeBrowserImageUrls() {
    browserImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    browserImageUrlsRef.current = [];
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      if (fileSyncTimerRef.current) window.clearTimeout(fileSyncTimerRef.current);
      revokeBrowserImageUrls();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveMarkdownImages() {
      revokeBrowserImageUrls();

      if (!activeDoc || activeDoc.sourceFormat !== 'markdown') {
        setImageSrcMap({});
        return;
      }

      const imageSources = Array.from(new Set(extractMarkdownImageSources(activeDoc.markdown))).filter(
        (src) => !isExternalAssetSrc(src),
      );
      if (!imageSources.length) {
        setImageSrcMap({});
        return;
      }

      const nextMap: Record<string, string> = {};

      await Promise.all(
        imageSources.map(async (src) => {
          const imagePath = decodeImagePath(src);
          if (!imagePath) return;

          if (isTauriRuntime() && activeDoc.filePath) {
            try {
              const asset = await readMarkdownImageWithTauri(activeDoc.filePath, imagePath);
              nextMap[src] = asset.dataUrl;
            } catch {
              // Keep the original relative src when the local image cannot be read.
            }
            return;
          }

          const rootHandle = browserFolderRootRef.current;
          if (!rootHandle || !activeDoc.filePath) return;

          const parts = resolveBrowserAssetParts(activeDoc.filePath, rootHandle.name, src);
          if (!parts?.length) return;

          try {
            let directory = rootHandle;
            for (const part of parts.slice(0, -1)) {
              directory = await directory.getDirectoryHandle(part);
            }
            const fileHandle = await directory.getFileHandle(parts[parts.length - 1]);
            const file = await fileHandle.getFile();
            const imageName = parts[parts.length - 1].toLowerCase();
            if (file.type && !file.type.startsWith('image/')) return;
            if (!file.type && !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(imageName)) return;
            if (cancelled) return;
            const objectUrl = URL.createObjectURL(file);
            browserImageUrlsRef.current.push(objectUrl);
            nextMap[src] = objectUrl;
          } catch {
            // Browser single-file mode has no permission to sibling images; leave src unchanged.
          }
        }),
      );

      if (!cancelled) setImageSrcMap(nextMap);
    }

    void resolveMarkdownImages();

    return () => {
      cancelled = true;
    };
  }, [activeDoc]);

  useEffect(() => {
    if (autoOpenAttemptedRef.current) return;
    autoOpenAttemptedRef.current = true;
    if (!isTauriRuntime()) return;
    const entries = loadRecentEntries();
    if (!entries.length) return;
    (async () => {
      for (const entry of entries) {
        try {
          const source = await readDocumentFileWithTauri(entry.filePath);
          await loadSourceDocument(source);
          return;
        } catch {
          setRecentEntries(removeRecent(entry.filePath));
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeDoc) return;
    storeNotes(buildStorageKey(activeDoc), activeDoc.contentHash, notes);
  }, [activeDoc, notes]);

  useEffect(() => {
    if (!activeDoc || !isTauriRuntime()) return;

    if (fileSyncTimerRef.current) {
      window.clearTimeout(fileSyncTimerRef.current);
      fileSyncTimerRef.current = null;
    }

    if (skipNextFileSyncRef.current) {
      skipNextFileSyncRef.current = false;
      setFileSyncState('桌面模式：等待标注');
      return;
    }

    setFileSyncState('等待同步...');
    fileSyncTimerRef.current = window.setTimeout(() => {
      void syncReviewFilesToDisk('auto');
    }, FILE_SYNC_DEBOUNCE_MS);

    return () => {
      if (fileSyncTimerRef.current) {
        window.clearTimeout(fileSyncTimerRef.current);
        fileSyncTimerRef.current = null;
      }
    };
  }, [activeDoc, notes]);

  useEffect(() => {
    if (!selectedBlock) {
      setDraftBlockId(null);
      setDraftInstruction('');
      setDraftMode('comment');
      setDraftRevisionType('replace');
      setDraftReplacementText('');
      setDraftAction('rewrite');
      setDraftPriority('medium');
      setDraftStatus('todo');
      setAutoSaveState('选择段落后输入建议');
      return;
    }

    const existing = findDraftNote(notes, selectedBlock.id, selectedRange, selectedNoteId);
    setDraftBlockId(selectedBlock.id);
    if (existing) {
      setDraftInstruction(existing.instruction);
      setDraftMode(isWordDoc ? 'comment' : getNoteMode(existing));
      setDraftRevisionType(existing.revisionType ?? 'replace');
      setDraftReplacementText(existing.replacementText ?? '');
      setDraftAction(existing.expectedAction);
      setDraftPriority(existing.priority);
      setDraftStatus(existing.status);
      setAutoSaveState('已自动保存');
    } else {
      setDraftInstruction('');
      setDraftMode('comment');
      setDraftRevisionType('replace');
      setDraftReplacementText('');
      setDraftAction('rewrite');
      setDraftPriority('medium');
      setDraftStatus('todo');
      setAutoSaveState('等待输入');
    }
  }, [isWordDoc, notes, selectedBlock, selectedNoteId, selectedRange]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!selectedBlock || draftBlockId !== selectedBlock.id) {
      return;
    }

    const instruction = draftInstruction.trim();
    const existing = findDraftNote(notes, selectedBlock.id, selectedRange, selectedNoteId);
    const mode: ReviewMode = isWordDoc ? 'comment' : draftMode;
    const replacementText = draftReplacementText.trim();
    const hasRevisionContent = mode === 'revision' && (draftRevisionType === 'delete' || replacementText.length > 0);

    if (!instruction && !hasRevisionContent) {
      setAutoSaveState(existing ? '内容为空，未覆盖原标注' : '等待输入');
      return;
    }

    const effectiveInstruction =
      instruction ||
      (draftRevisionType === 'delete'
        ? '删除所选片段'
        : draftRevisionType === 'insert'
          ? '在所选片段附近插入补充内容'
          : '替换所选片段');
    const selectedSnippet = selectedRange?.text || selectedText || existing?.selectedText;
    const hasChanged =
      !existing ||
      getNoteMode(existing) !== mode ||
      existing.instruction !== effectiveInstruction ||
      existing.expectedAction !== draftAction ||
      existing.priority !== draftPriority ||
      existing.status !== draftStatus ||
      existing.selectedText !== selectedSnippet ||
      existing.selectionRange?.startOffset !== selectedRange?.startOffset ||
      existing.selectionRange?.endOffset !== selectedRange?.endOffset ||
      existing.revisionType !== (mode === 'revision' ? draftRevisionType : undefined) ||
      (existing.replacementText ?? '') !== (mode === 'revision' ? replacementText : '');

    if (!hasChanged) {
      setAutoSaveState('已自动保存');
      return;
    }

    setAutoSaveState('正在自动保存...');
    autoSaveTimerRef.current = window.setTimeout(() => {
      const now = new Date().toISOString();
      let savedNoteId: string | null = null;

      setNotes((current) => {
        const currentExisting = findDraftNote(current, selectedBlock.id, selectedRange, selectedNoteId);
        const currentSelectedSnippet = selectedRange?.text || selectedText || currentExisting?.selectedText;
        const nextNoteId = currentExisting?.id ?? makeNoteId();
        savedNoteId = nextNoteId;
        const nextNote: ReviewNote = {
          id: nextNoteId,
          blockId: selectedBlock.id,
          blockType: selectedBlock.type,
          startLine: selectedBlock.startLine,
          endLine: selectedBlock.endLine,
          headingPath: selectedBlock.headingPath,
          originalMarkdown: selectedBlock.raw,
          selectedText: currentSelectedSnippet,
          selectionRange: selectedRange ?? currentExisting?.selectionRange,
          mode,
          revisionType: mode === 'revision' ? draftRevisionType : undefined,
          replacementText: mode === 'revision' ? replacementText : undefined,
          instruction: effectiveInstruction,
          expectedAction: draftAction,
          priority: draftPriority,
          status: draftStatus,
          createdAt: currentExisting?.createdAt ?? now,
          updatedAt: now,
        };

        if (!currentExisting) return [nextNote, ...current];
        return current.map((note) => (note.id === currentExisting.id ? nextNote : note));
      });
      if (savedNoteId) setSelectedNoteId(savedNoteId);
      setAutoSaveState('已自动保存');
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    draftAction,
    draftBlockId,
    draftInstruction,
    draftMode,
    draftPriority,
    draftReplacementText,
    draftRevisionType,
    draftStatus,
    isWordDoc,
    notes,
    selectedBlock,
    selectedNoteId,
    selectedRange,
    selectedText,
  ]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), TOAST_DURATION_MS);
  }

  function loadDocument(document: LoadedDocument, message = `已打开 ${document.fileName}`) {
    skipNextFileSyncRef.current = true;
    const { notes: storedNotes, storedHash } = loadStoredNotes(buildStorageKey(document));
    setActiveDoc(document);
    setMarkdown(document.markdown);
    setNotes(storedNotes);
    setSelectedBlockId(null);
    setSelectedNoteId(null);
    setSelectedText('');
    setSelectedRange(null);
    setViewMode('preview');
    setFileSyncState(isTauriRuntime() ? '桌面模式：等待标注' : '浏览器模式：手动导出');
    if (isTauriRuntime() && document.filePath) {
      setRecentEntries(recordRecent(document));
    }
    // 标注键不再含内容指纹，原文变更后标注不会丢失；但行号/块号定位可能已偏移，显式提示用户核对。
    const drifted = storedNotes.length > 0 && storedHash != null && storedHash !== document.contentHash;
    showToast(drifted ? `${message}（注意：原文自上次标注后已变更，定位可能偏移，请核对）` : message);
  }

  async function reopenRecent(entry: RecentEntry) {
    if (!isTauriRuntime()) {
      showToast('浏览器模式下需要手动重新选择该文件');
      return;
    }
    try {
      const source = await readDocumentFileWithTauri(entry.filePath);
      await loadSourceDocument(source);
    } catch (error) {
      if (isTauriCancel(error)) return;
      setRecentEntries(removeRecent(entry.filePath));
      showToast(`无法打开 ${entry.fileName}，已从最近列表移除`);
    }
  }

  function dropRecent(filePath: string) {
    setRecentEntries(removeRecent(filePath));
  }

  function clearAllRecent() {
    setRecentEntries(clearRecent());
    showToast('最近打开列表已清空');
  }

  async function loadSourceDocument(source: LoadedSourceDocument) {
    if (source.sourceFormat === 'docx') {
      if (!source.bytesBase64) throw new Error('Word 文件内容为空');
      showToast(`正在转换 Word：${source.fileName}...`);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const document = await convertWordToDocument(
        source.fileName,
        source.filePath,
        arrayBufferFromBase64(source.bytesBase64),
      );
      loadDocument(document, `已打开 Word：${source.fileName}`);
      return;
    }

    const markdownSource = source.markdown ?? '';
    const parsedDoc = parseMarkdown(markdownSource);
    loadDocument(
      {
        fileName: source.fileName,
        filePath: source.filePath,
        markdown: markdownSource,
        contentHash: source.contentHash ?? createContentHash(markdownSource),
        totalLines: source.totalLines ?? parsedDoc.totalLines,
        sourceFormat: 'markdown',
        conversionMessages: source.conversionMessages,
      },
      `已打开 ${source.fileName}`,
    );
  }

  async function loadFile(file: File, filePath = file.name) {
    if (/\.docx$/i.test(file.name)) {
      showToast(`正在转换 Word：${file.name}...`);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const document = await convertWordToDocument(file.name, filePath, await file.arrayBuffer());
      loadDocument(document, `已打开 Word：${file.name}`);
      return;
    }

    const text = await file.text();
    const hash = createContentHash(text);
    const parsedDoc = parseMarkdown(text);
    const nextDoc: LoadedDocument = {
      fileName: file.name,
      filePath,
      markdown: text,
      contentHash: hash,
      totalLines: parsedDoc.totalLines,
      sourceFormat: 'markdown',
    };

    loadDocument(nextDoc);
  }

  async function syncReviewFilesToDisk(mode: 'auto' | 'manual') {
    if (!activeDoc || !isTauriRuntime()) return null;

    const aiNotesJson = JSON.stringify(buildAgentNotesJson(activeDoc, notes), null, 2);
    const reviewMarkdown = buildReviewMarkdown(activeDoc, notes);
    const nextAiHash = createContentHash(aiNotesJson);
    const nextReviewHash = createContentHash(reviewMarkdown);

    // 自动同步前先检查原文目录的 sidecar 是否被外部（人或 Agent）改动过，避免静默覆盖。
    // 判定“外部改动”：磁盘内容既不等于我们即将写入的新内容，也不等于上次写出的基线（或无基线）。
    // 手动“保存”视为用户明确的覆盖意图，跳过此保护直接写入。
    if (mode === 'auto') {
      try {
        const existing = await readReviewFilesWithTauri(activeDoc.filePath);
        const baseline = loadSyncBaseline(activeDoc.filePath);
        const aiChangedOutside =
          existing.aiNotes != null &&
          createContentHash(existing.aiNotes) !== nextAiHash &&
          (baseline == null || createContentHash(existing.aiNotes) !== baseline.aiHash);
        const reviewChangedOutside =
          existing.review != null &&
          createContentHash(existing.review) !== nextReviewHash &&
          (baseline == null || createContentHash(existing.review) !== baseline.reviewHash);
        if (aiChangedOutside || reviewChangedOutside) {
          setFileSyncState('检测到外部修改，自动同步已暂停');
          showToast('审阅文件被外部修改，自动同步已暂停；点"保存"可手动覆盖');
          return null;
        }
      } catch {
        // 读取现存 sidecar 失败（通常是文件尚不存在），不阻塞首次写入。
      }
    }

    try {
      setFileSyncState(mode === 'manual' ? '正在手动同步...' : '正在同步任务文件...');
      const result = await writeReviewFilesWithTauri(activeDoc.filePath, aiNotesJson, reviewMarkdown);
      storeSyncBaseline(activeDoc.filePath, nextAiHash, nextReviewHash);
      setFileSyncState('已同步任务文件');
      if (mode === 'manual') showToast('任务文件已同步到原文目录');
      return result;
    } catch {
      setFileSyncState('同步失败');
      showToast('任务文件同步失败');
      return null;
    }
  }

  async function openMarkdownFile() {
    if (isTauriRuntime()) {
      try {
        browserFolderRootRef.current = null;
        const document = await openDocumentFileWithTauri();
        await loadSourceDocument(document);
      } catch (error) {
        if (isTauriCancel(error)) return;
        showToast('文档读取失败');
      }
      return;
    }

    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: '文档',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'text/plain': ['.md', '.markdown'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              },
            },
          ],
        });
        const file = await handle.getFile();
        browserFolderRootRef.current = null;
        await loadFile(file, file.name);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('openMarkdownFile (browser picker) failed', error);
        showToast('文档读取失败');
        return;
      }
    }

    fileInputRef.current?.click();
  }

  async function openFolder() {
    if (isTauriRuntime()) {
      try {
        browserFolderRootRef.current = null;
        const folder = await openMarkdownFolderWithTauri();
        setFolderFiles(folder.files);
        showToast(`已读取 ${folder.files.length} 个文档`);
        if (folder.files[0]) {
          const document = await readDocumentFileWithTauri(folder.files[0].path);
          await loadSourceDocument(document);
        }
      } catch (error) {
        if (isTauriCancel(error)) return;
        showToast('文件夹读取失败');
      }
      return;
    }

    if (!window.showDirectoryPicker) {
      showToast('当前浏览器暂不支持文件夹读取');
      return;
    }

    try {
      const directory = await window.showDirectoryPicker();
      browserFolderRootRef.current = directory;
      const files = await collectDocumentFiles(directory, directory.name);
      setFolderFiles(files);
      showToast(`已读取 ${files.length} 个文档`);
      const firstFile = files[0];
      if (firstFile?.handle) {
        const file = await firstFile.handle.getFile();
        await loadFile(file, firstFile.path);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('文件夹读取失败');
    }
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    browserFolderRootRef.current = null;
    loadFile(file, file.name).catch((error) => {
      console.error('loadFile failed', error);
      showToast('文档读取失败');
    });
    event.target.value = '';
  }

  function focusBlock(blockId: string) {
    setSelectedBlockId(blockId);
    setSelectedNoteId(null);
    setSelectedText('');
    setSelectedRange(null);
    window.requestAnimationFrame(() => {
      document.getElementById(blockId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function focusNote(note: ReviewNote) {
    setSelectedBlockId(note.blockId);
    setSelectedNoteId(note.id);
    setSelectedText(note.selectedText ?? '');
    setSelectedRange(note.selectionRange ?? null);
    window.requestAnimationFrame(() => {
      document.getElementById(note.blockId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function toggleInspectorExpansion(target: Exclude<InspectorExpansion, 'none'>) {
    setInspectorExpansion((current) => (current === target ? 'none' : target));
  }

  function handlePreviewMouseUp() {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!text || !selection?.anchorNode || !previewRef.current?.contains(selection.anchorNode)) {
      return;
    }

    const anchor =
      selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode.parentElement;
    const blockElement = anchor?.closest<HTMLElement>('[data-block-id]');
    const blockId = blockElement?.dataset.blockId;
    const bodyElement = anchor?.closest<HTMLElement>('.markdown-body, .word-body');
    const range = selection && bodyElement ? createSelectionRange(selection, bodyElement, text) : null;
    if (blockId) {
      const matchingNote = notes.find((note) => noteMatchesSelection(note, blockId, range));
      setSelectedBlockId(blockId);
      setSelectedNoteId(matchingNote?.id ?? null);
    }
    setSelectedText(text);
    setSelectedRange(range);
  }

  function handleBlockClick(blockId: string, event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const mark = target.closest<HTMLElement>('[data-note-id]');
    const noteId = mark?.dataset.noteId;
    if (noteId) {
      const note = notes.find((item) => item.id === noteId);
      if (note) focusNote(note);
      return;
    }

    const selectionText = window.getSelection()?.toString().trim();
    if (selectionText) return;
    setSelectedBlockId(blockId);
    setSelectedNoteId(null);
    setSelectedText('');
    setSelectedRange(null);
  }

  function removeNote(noteId: string) {
    setNotes((current) => current.filter((note) => note.id !== noteId));
    if (selectedNoteId === noteId) {
      setSelectedNoteId(null);
      setSelectedText('');
      setSelectedRange(null);
    }
    showToast('标注已移除');
  }

  async function exportJson() {
    if (!activeDoc) return;
    if (isTauriRuntime()) {
      await syncReviewFilesToDisk('manual');
      return;
    }

    try {
      const contents = JSON.stringify(buildAgentNotesJson(activeDoc, notes), null, 2);
      await saveTextFile(contents, `${getBaseName(activeDoc.fileName)}.ai-notes.json`, 'application/json');
      showToast('JSON 已导出');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('JSON 导出失败');
    }
  }

  async function exportReviewMarkdown() {
    if (!activeDoc) return;
    if (isTauriRuntime()) {
      await syncReviewFilesToDisk('manual');
      return;
    }

    try {
      const contents = buildReviewMarkdown(activeDoc, notes);
      await saveTextFile(contents, `${getBaseName(activeDoc.fileName)}.review.md`, 'text/markdown');
      showToast('Review 已导出');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('Review 导出失败');
    }
  }

  const filteredOutline = parsed.outline.filter((item) => {
    if (!searchTerm) return true;
    return item.title.toLowerCase().includes(searchTerm) || item.path.join(' ').toLowerCase().includes(searchTerm);
  });

  const visibleBlocks = parsed.blocks;

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        accept=".md,.markdown,.docx,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileInput}
      />

      <aside className="left-rail">
        <div className="brand-row">
          <div className="brand-mark">
            <FileText size={18} />
          </div>
          <div>
            <h1>文档标注</h1>
            <span>Document Review</span>
          </div>
        </div>

        <div className="rail-actions">
          <button className="command-button primary" type="button" onClick={openMarkdownFile}>
            <FileText size={16} />
            打开文档
          </button>
          <button className="command-button" type="button" onClick={openFolder}>
            <FolderOpen size={16} />
            打开文件夹
          </button>
        </div>

        <div className="search-box">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题或正文"
            aria-label="搜索标题或正文"
          />
        </div>

        <section className="rail-section">
          <div className="section-title">
            <ListTree size={15} />
            大纲
          </div>
          <div className="outline-list">
            {filteredOutline.length ? (
              filteredOutline.map((item) => (
                <button
                  key={item.id}
                  className={`outline-item level-${item.level}`}
                  type="button"
                  onClick={() => focusBlock(item.id)}
                >
                  <span>{item.title}</span>
                  <small>{item.line}</small>
                </button>
              ))
            ) : (
              <div className="empty-line">暂无标题</div>
            )}
          </div>
        </section>

        {folderFiles.length > 0 && (
          <section className="rail-section folder-section">
            <div className="section-title">
              <FolderOpen size={15} />
              文件夹
            </div>
            <div className="folder-list">
              {folderFiles.map((item) => (
                <button
                  key={item.path}
                  className={`folder-file ${activeDoc?.filePath === item.path ? 'active' : ''}`}
                  type="button"
                  onClick={async () => {
                    try {
                      if (item.handle) {
                        const file = await item.handle.getFile();
                        await loadFile(file, item.path);
                        return;
                      }
                      const document = await readDocumentFileWithTauri(item.path);
                      await loadSourceDocument(document);
                    } catch (error) {
                      console.error('open folder item failed', error);
                      showToast('文档读取失败');
                    }
                  }}
                >
                  <FileText size={14} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {recentEntries.length > 0 && (
          <section className="rail-section recent-section">
            <div className="section-title">
              <History size={15} />
              最近打开
              <button
                className="link-button"
                type="button"
                onClick={clearAllRecent}
                title="清空最近打开列表"
              >
                清空
              </button>
            </div>
            <div className="recent-list">
              {recentEntries.map((entry) => (
                <div
                  key={entry.filePath}
                  className={`recent-item ${activeDoc?.filePath === entry.filePath ? 'active' : ''}`}
                >
                  <button
                    className="recent-main"
                    type="button"
                    onClick={() => void reopenRecent(entry)}
                    title={entry.filePath}
                  >
                    <FileText size={13} />
                    <span>{entry.fileName}</span>
                    <small>
                      <Clock size={10} />
                      {formatRelativeTime(entry.lastOpenedAt)}
                    </small>
                  </button>
                  <button
                    className="icon-button tiny"
                    type="button"
                    onClick={() => dropRecent(entry.filePath)}
                    title="从最近列表移除"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="doc-title">
            <span>{activeDoc?.fileName ?? '未打开文档'}</span>
            {activeDoc && (
              <small>
                {isWordDoc
                  ? `${parsed.blocks.length} 块 / ${notes.length} 条标注 / ${fileSyncState}`
                  : `${parsed.totalLines} 行 / ${parsed.blocks.length} 块 / ${notes.length} 条标注 / ${fileSyncState}`}
              </small>
            )}
          </div>

          <div className="topbar-actions">
            <div className="segmented" aria-label="视图切换">
              <button
                className={viewMode === 'preview' ? 'active' : ''}
                type="button"
                onClick={() => setViewMode('preview')}
                title="预览"
              >
                <Eye size={15} />
                预览
              </button>
              <button
                className={viewMode === 'source' ? 'active' : ''}
                type="button"
                onClick={() => setViewMode('source')}
                title="源码"
              >
                <Code2 size={15} />
                源码
              </button>
            </div>

            <button
              className="command-button compact"
              type="button"
              onClick={() => {
                if (isTauriRuntime()) {
                  void syncReviewFilesToDisk('manual');
                } else {
                  showToast('标注已保存到浏览器本地');
                }
              }}
              disabled={!activeDoc}
              title={isTauriRuntime() ? '立即写入原文目录的 .ai-notes.json 和 .review.md' : '标注已保存到浏览器本地存储'}
            >
              <Save size={15} />
              保存
            </button>
            <button className="command-button compact" type="button" onClick={exportJson} disabled={!activeDoc || notes.length === 0}>
              <Download size={15} />
              JSON
            </button>
            <button className="command-button compact" type="button" onClick={exportReviewMarkdown} disabled={!activeDoc || notes.length === 0}>
              <Download size={15} />
              Review
            </button>
          </div>
        </header>

        <section className="document-stage">
          {!activeDoc ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FileText size={30} />
              </div>
              <h2>文档审阅标注工作台</h2>
              <button className="command-button primary large" type="button" onClick={openMarkdownFile}>
                <FileText size={17} />
                打开文档
              </button>

              {recentEntries.length > 0 && (
                <div className="empty-recent">
                  <div className="empty-recent-title">
                    <History size={14} />
                    最近打开
                  </div>
                  <div className="empty-recent-list">
                    {recentEntries.slice(0, 8).map((entry) => (
                      <div key={entry.filePath} className="empty-recent-item">
                        <button
                          type="button"
                          className="empty-recent-main"
                          onClick={() => void reopenRecent(entry)}
                          title={entry.filePath}
                        >
                          <FileText size={14} />
                          <div className="empty-recent-text">
                            <strong>{entry.fileName}</strong>
                            <small>{formatRelativeTime(entry.lastOpenedAt)} · {entry.filePath}</small>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="icon-button tiny"
                          onClick={() => dropRecent(entry.filePath)}
                          title="从最近列表移除"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'preview' ? (
            <div
              className={`document-preview${isWordDoc ? ' word-mode' : ''}`}
              ref={previewRef}
              onMouseUp={handlePreviewMouseUp}
            >
              {isWordDoc ? (
                <div className="word-page">
                  {visibleBlocks.map((block) => {
                    const blockNotes = notesByBlock.get(block.id) ?? [];
                    const hasNote = blockNotes.length > 0;
                    const isSelected = block.id === selectedBlockId;
                    const isMatch =
                      searchTerm &&
                      (block.plain.toLowerCase().includes(searchTerm) ||
                        block.headingPath.join(' ').toLowerCase().includes(searchTerm));

                    return (
                      <article
                        key={block.id}
                        id={block.id}
                        data-block-id={block.id}
                        className={`word-block ${isSelected ? 'selected' : ''} ${hasNote ? 'annotated' : ''} ${
                          isMatch ? 'matched' : ''
                        } block-${block.type}`}
                        onClick={(event) => handleBlockClick(block.id, event)}
                      >
                        <div className="word-block-chrome">
                          <span>{blockTypeLabels[block.type]}</span>
                          <span>#{block.startLine}</span>
                          {hasNote && (
                            <>
                              <Check size={14} />
                              <span>{blockNotes.length}</span>
                            </>
                          )}
                        </div>
                        <div
                          className="word-body"
                          dangerouslySetInnerHTML={{
                            __html: buildBlockHtmlWithNotes(block.html ?? '', blockNotes, selectedNoteId),
                          }}
                        />
                      </article>
                    );
                  })}
                </div>
              ) : (
                visibleBlocks.map((block) => {
                  const blockNotes = notesByBlock.get(block.id) ?? [];
                  const hasNote = blockNotes.length > 0;
                  const isSelected = block.id === selectedBlockId;
                  const isMatch =
                    searchTerm &&
                    (block.raw.toLowerCase().includes(searchTerm) ||
                      block.headingPath.join(' ').toLowerCase().includes(searchTerm));

                  return (
                    <article
                      key={block.id}
                      id={block.id}
                      data-block-id={block.id}
                      className={`review-block ${isSelected ? 'selected' : ''} ${hasNote ? 'annotated' : ''} ${
                        isMatch ? 'matched' : ''
                      } block-${block.type}`}
                      onClick={(event) => handleBlockClick(block.id, event)}
                    >
                      <div className="block-chrome">
                        <span>{blockTypeLabels[block.type]}</span>
                        <span>{formatLineRange(block)}</span>
                        {hasNote && (
                          <>
                            <Check size={14} />
                            <span>{blockNotes.length}</span>
                          </>
                        )}
                      </div>
                      <div
                        className="markdown-body"
                        dangerouslySetInnerHTML={{
                          __html: buildBlockHtmlWithNotes(
                            renderMarkdownHtml(block.raw, resolveMarkdownImageSrc),
                            blockNotes,
                            selectedNoteId,
                          ),
                        }}
                      />
                    </article>
                  );
                })
              )}
            </div>
          ) : (
            <textarea
              className="source-pane"
              value={isWordDoc ? activeDoc?.html ?? '' : markdown}
              readOnly
              aria-label={isWordDoc ? 'Word 源 HTML' : 'Markdown 源码'}
            />
          )}
        </section>
      </main>

      <aside className="right-rail">
        <div className="inspector-header">
          <div>
            <h2>标注面板</h2>
            <span>
              {selectedBlock ? formatLineRange(selectedBlock, isWordDoc ? 'block' : 'line') : '未选择位置'}
            </span>
          </div>
          <PanelRightOpen size={18} />
        </div>

        <section className={`inspector-section selected-card ${inspectorExpansion === 'excerpt' ? 'expanded' : ''}`}>
          {selectedBlock ? (
            <>
              <div className="selected-card-header">
                <span>选中内容</span>
                <button
                  className="inline-toggle-button"
                  type="button"
                  aria-controls="selected-excerpt"
                  aria-expanded={inspectorExpansion === 'excerpt'}
                  onClick={() => toggleInspectorExpansion('excerpt')}
                >
                  {inspectorExpansion === 'excerpt' ? '收起原文' : '展开原文'}
                </button>
              </div>
              <div className="meta-grid">
                <span>类型</span>
                <strong>{blockTypeLabels[selectedBlock.type]}</strong>
                <span>章节</span>
                <strong>{selectedBlock.headingPath.length ? selectedBlock.headingPath.join(' / ') : '未归入标题'}</strong>
                <span>粒度</span>
                <strong>
                  {selectedRange
                    ? `片段 ${selectedRange.startOffset}-${selectedRange.endOffset}`
                    : selectedNote?.selectionRange
                      ? `片段 ${selectedNote.selectionRange.startOffset}-${selectedNote.selectionRange.endOffset}`
                      : '整块'}
                </strong>
                <span>模式</span>
                <strong>{draftMode === 'revision' ? '修订' : '批注'}</strong>
              </div>
              <div className="excerpt-box" id="selected-excerpt">
                {selectedExcerpt}
              </div>
            </>
          ) : (
            <div className="empty-line">选择一个段落后开始标注</div>
          )}
        </section>

        <section className="inspector-section editor-section">
          <div className="mode-row">
            <span>记录类型</span>
            <div className="segmented compact" aria-label="记录类型">
              <button
                className={draftMode === 'comment' ? 'active' : ''}
                type="button"
                disabled={!selectedBlock}
                onClick={() => setDraftMode('comment')}
              >
                批注
              </button>
              <button
                className={draftMode === 'revision' ? 'active' : ''}
                type="button"
                disabled={!selectedBlock || isWordDoc}
                title={isWordDoc ? 'Word 文档暂只支持批注' : '以 sidecar 记录 Markdown 修订，不覆盖原文'}
                onClick={() => setDraftMode('revision')}
              >
                修订
              </button>
            </div>
          </div>

          {draftMode === 'revision' && !isWordDoc && (
            <div className="revision-box">
              <label className="field-label">
                修订动作
                <select
                  value={draftRevisionType}
                  disabled={!selectedBlock}
                  onChange={(event) => setDraftRevisionType(event.target.value as RevisionType)}
                >
                  {revisionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {draftRevisionType !== 'delete' && (
                <label className="field-label">
                  {draftRevisionType === 'insert' ? '插入内容' : '替换为'}
                  <textarea
                    className="revision-input"
                    value={draftReplacementText}
                    disabled={!selectedBlock}
                    onChange={(event) => setDraftReplacementText(event.target.value)}
                    placeholder={
                      draftRevisionType === 'insert'
                        ? '输入需要补充插入的 Markdown 文本。'
                        : '输入替换后的 Markdown 文本。'
                    }
                  />
                </label>
              )}
            </div>
          )}

          <label className="field-label" htmlFor="instruction">
            <span className="label-row">
              {draftMode === 'revision' ? '修订说明' : '修改建议'}
              <small>{autoSaveState}</small>
            </span>
          </label>
          <textarea
            id="instruction"
            className="instruction-input"
            value={draftInstruction}
            disabled={!selectedBlock}
            onChange={(event) => setDraftInstruction(event.target.value)}
            placeholder={
              draftMode === 'revision'
                ? '可选：说明本次修订原因。删除修订可直接保存。'
                : '例如：这里太泛，补充项目落地经验，语气改成投标响应风格。'
            }
          />

          <div className="field-row">
            <label>
              动作
              <select
                value={draftAction}
                disabled={!selectedBlock}
                onChange={(event) => setDraftAction(event.target.value as ExpectedAction)}
              >
                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              优先级
              <select
                value={draftPriority}
                disabled={!selectedBlock}
                onChange={(event) => setDraftPriority(event.target.value as NotePriority)}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-label">
            状态
            <select
              value={draftStatus}
              disabled={!selectedBlock}
              onChange={(event) => setDraftStatus(event.target.value as NoteStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="autosave-hint">
            {selectedBlock
              ? draftMode === 'revision'
                ? '修订仅写入 sidecar，不会覆盖原 Markdown；替换/插入需填写修订内容，删除可直接保存。'
                : '输入非空修改建议后自动保存。清空输入框不会覆盖已有标注。'
              : '选择文档位置后开始填写。'}
          </div>
        </section>

        <section className={`inspector-section notes-section ${inspectorExpansion === 'notes' ? 'expanded' : ''}`}>
          <div className="section-title">
            <AlertCircle size={15} />
            修改点
            <strong>{notes.length}</strong>
            {notes.length > 2 && (
              <button
                className="inline-toggle-button"
                type="button"
                aria-controls="notes-list"
                aria-expanded={inspectorExpansion === 'notes'}
                onClick={() => toggleInspectorExpansion('notes')}
              >
                {inspectorExpansion === 'notes' ? '收起列表' : '展开全部'}
              </button>
            )}
          </div>

          <div className="notes-list" id="notes-list">
            {notes.length ? (
              visibleInspectorNotes.map((note, index) => (
                <div className={`note-item priority-${note.priority}`} key={note.id}>
                  <button className="note-main" type="button" onClick={() => focusNote(note)}>
                    <span>
                      {String(index + 1).padStart(2, '0')} / {getNoteMode(note) === 'revision' ? '修订' : '批注'} /{' '}
                      {formatLineRange(note, isWordDoc ? 'block' : 'line')}
                    </span>
                    <strong>{note.instruction}</strong>
                    <small>
                      {note.selectionRange
                        ? `片段 ${note.selectionRange.startOffset}-${note.selectionRange.endOffset}`
                        : '整块'}{' '}
                      · {note.headingPath.length ? note.headingPath.join(' / ') : '未归入标题'}
                    </small>
                  </button>
                  <button className="icon-button" type="button" onClick={() => removeNote(note.id)} title="删除标注">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-line">暂无修改点</div>
            )}
          </div>
        </section>
      </aside>

      {toast && (
        <div className="toast" role="status">
          <ChevronRight size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
