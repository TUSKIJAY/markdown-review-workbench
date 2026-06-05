import { useEffect, useMemo, useRef, useState } from 'react';
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
  ReviewNote,
} from './types';
import { createContentHash, getBaseName, parseMarkdown, renderMarkdownHtml } from './utils/markdown';
import { buildAgentNotesJson, buildReviewMarkdown, saveTextFile } from './utils/export';
import { buildStorageKey, loadStoredNotes, storeNotes } from './utils/storage';
import {
  isTauriCancel,
  isTauriRuntime,
  openDocumentFileWithTauri,
  openMarkdownFolderWithTauri,
  readDocumentFileWithTauri,
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

  const [activeDoc, setActiveDoc] = useState<LoadedDocument | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [folderFiles, setFolderFiles] = useState<FolderMarkdownFile[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');

  const [draftBlockId, setDraftBlockId] = useState<string | null>(null);
  const [draftInstruction, setDraftInstruction] = useState('');
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
  const noteMap = useMemo(() => new Map(notes.map((note) => [note.blockId, note])), [notes]);
  const searchTerm = query.trim().toLowerCase();

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      if (fileSyncTimerRef.current) window.clearTimeout(fileSyncTimerRef.current);
    };
  }, []);

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
    storeNotes(buildStorageKey(activeDoc.fileName, activeDoc.contentHash), notes);
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
    }, 850);

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
      setDraftAction('rewrite');
      setDraftPriority('medium');
      setDraftStatus('todo');
      setAutoSaveState('选择段落后输入建议');
      return;
    }

    const existing = noteMap.get(selectedBlock.id);
    setDraftBlockId(selectedBlock.id);
    if (existing) {
      setDraftInstruction(existing.instruction);
      setDraftAction(existing.expectedAction);
      setDraftPriority(existing.priority);
      setDraftStatus(existing.status);
      setAutoSaveState('已自动保存');
    } else {
      setDraftInstruction('');
      setDraftAction('rewrite');
      setDraftPriority('medium');
      setDraftStatus('todo');
      setAutoSaveState('等待输入');
    }
  }, [noteMap, selectedBlock]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!selectedBlock || draftBlockId !== selectedBlock.id) {
      return;
    }

    const instruction = draftInstruction.trim();
    const existing = noteMap.get(selectedBlock.id);

    if (!instruction) {
      setAutoSaveState(existing ? '内容为空，未覆盖原标注' : '等待输入');
      return;
    }

    const selectedSnippet = selectedText || existing?.selectedText;
    const hasChanged =
      !existing ||
      existing.instruction !== instruction ||
      existing.expectedAction !== draftAction ||
      existing.priority !== draftPriority ||
      existing.status !== draftStatus ||
      existing.selectedText !== selectedSnippet;

    if (!hasChanged) {
      setAutoSaveState('已自动保存');
      return;
    }

    setAutoSaveState('正在自动保存...');
    autoSaveTimerRef.current = window.setTimeout(() => {
      const now = new Date().toISOString();

      setNotes((current) => {
        const currentExisting = current.find((note) => note.blockId === selectedBlock.id);
        const currentSelectedSnippet = selectedText || currentExisting?.selectedText;
        const nextNote: ReviewNote = {
          id: currentExisting?.id ?? makeNoteId(),
          blockId: selectedBlock.id,
          blockType: selectedBlock.type,
          startLine: selectedBlock.startLine,
          endLine: selectedBlock.endLine,
          headingPath: selectedBlock.headingPath,
          originalMarkdown: selectedBlock.raw,
          selectedText: currentSelectedSnippet,
          instruction,
          expectedAction: draftAction,
          priority: draftPriority,
          status: draftStatus,
          createdAt: currentExisting?.createdAt ?? now,
          updatedAt: now,
        };

        if (!currentExisting) return [nextNote, ...current];
        return current.map((note) => (note.id === currentExisting.id ? nextNote : note));
      });
      setAutoSaveState('已自动保存');
    }, 550);

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
    draftPriority,
    draftStatus,
    noteMap,
    selectedBlock,
    selectedText,
  ]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2600);
  }

  function loadDocument(document: LoadedDocument, message = `已打开 ${document.fileName}`) {
    skipNextFileSyncRef.current = true;
    setActiveDoc(document);
    setMarkdown(document.markdown);
    setNotes(loadStoredNotes(buildStorageKey(document.fileName, document.contentHash)));
    setSelectedBlockId(null);
    setSelectedText('');
    setViewMode('preview');
    setFileSyncState(isTauriRuntime() ? '桌面模式：等待标注' : '浏览器模式：手动导出');
    if (isTauriRuntime() && document.filePath) {
      setRecentEntries(recordRecent(document));
    }
    showToast(message);
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

    try {
      setFileSyncState(mode === 'manual' ? '正在手动同步...' : '正在同步任务文件...');
      const aiNotesJson = JSON.stringify(buildAgentNotesJson(activeDoc, notes), null, 2);
      const reviewMarkdown = buildReviewMarkdown(activeDoc, notes);
      const result = await writeReviewFilesWithTauri(activeDoc.filePath, aiNotesJson, reviewMarkdown);
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
    loadFile(file, file.name).catch((error) => {
      console.error('loadFile failed', error);
      showToast('文档读取失败');
    });
    event.target.value = '';
  }

  function focusBlock(blockId: string) {
    setSelectedBlockId(blockId);
    setSelectedText('');
    window.requestAnimationFrame(() => {
      document.getElementById(blockId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
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
    if (blockId) setSelectedBlockId(blockId);
    setSelectedText(text);
  }

  function removeNote(noteId: string) {
    setNotes((current) => current.filter((note) => note.id !== noteId));
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
                    const hasNote = noteMap.has(block.id);
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
                        onClick={() => {
                          setSelectedBlockId(block.id);
                          setSelectedText('');
                        }}
                      >
                        <div className="word-block-chrome">
                          <span>{blockTypeLabels[block.type]}</span>
                          <span>#{block.startLine}</span>
                          {hasNote && <Check size={14} />}
                        </div>
                        <div
                          className="word-body"
                          dangerouslySetInnerHTML={{ __html: block.html ?? '' }}
                        />
                      </article>
                    );
                  })}
                </div>
              ) : (
                visibleBlocks.map((block) => {
                  const hasNote = noteMap.has(block.id);
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
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setSelectedText('');
                      }}
                    >
                      <div className="block-chrome">
                        <span>{blockTypeLabels[block.type]}</span>
                        <span>{formatLineRange(block)}</span>
                        {hasNote && <Check size={14} />}
                      </div>
                      <div
                        className="markdown-body"
                        dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(block.raw) }}
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

        <section className="inspector-section selected-card">
          {selectedBlock ? (
            <>
              <div className="meta-grid">
                <span>类型</span>
                <strong>{blockTypeLabels[selectedBlock.type]}</strong>
                <span>章节</span>
                <strong>{selectedBlock.headingPath.length ? selectedBlock.headingPath.join(' / ') : '未归入标题'}</strong>
              </div>
              <div className="excerpt-box">{selectedText || selectedBlock.plain || selectedBlock.raw}</div>
            </>
          ) : (
            <div className="empty-line">选择一个段落后开始标注</div>
          )}
        </section>

        <section className="inspector-section">
          <label className="field-label" htmlFor="instruction">
            <span className="label-row">
              修改建议
              <small>{autoSaveState}</small>
            </span>
          </label>
          <textarea
            id="instruction"
            className="instruction-input"
            value={draftInstruction}
            disabled={!selectedBlock}
            onChange={(event) => setDraftInstruction(event.target.value)}
            placeholder="例如：这里太泛，补充项目落地经验，语气改成投标响应风格。"
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
          <div className="autosave-hint">{selectedBlock ? '输入非空修改建议后自动保存。清空输入框不会覆盖已有标注。' : '选择文档位置后开始填写。'}</div>
        </section>

        <section className="inspector-section notes-section">
          <div className="section-title">
            <AlertCircle size={15} />
            修改点
            <strong>{notes.length}</strong>
          </div>

          <div className="notes-list">
            {notes.length ? (
              notes.map((note, index) => (
                <div className={`note-item priority-${note.priority}`} key={note.id}>
                  <button className="note-main" type="button" onClick={() => focusBlock(note.blockId)}>
                    <span>
                      {String(index + 1).padStart(2, '0')} / {formatLineRange(note, isWordDoc ? 'block' : 'line')}
                    </span>
                    <strong>{note.instruction}</strong>
                    <small>{note.headingPath.length ? note.headingPath.join(' / ') : '未归入标题'}</small>
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
