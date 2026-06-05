export type BlockType = 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'table' | 'rule';

export type NotePriority = 'low' | 'medium' | 'high';

export type NoteStatus = 'todo' | 'draft' | 'reviewed' | 'done';

export type ExpectedAction = 'rewrite' | 'expand' | 'tighten' | 'verify' | 'format' | 'custom';

export type SourceFormat = 'markdown' | 'docx';

export interface MarkdownBlock {
  id: string;
  index: number;
  type: BlockType;
  raw: string;
  plain: string;
  startLine: number;
  endLine: number;
  headingPath: string[];
  headingLevel?: number;
  html?: string;
}

export interface OutlineItem {
  id: string;
  title: string;
  level: number;
  line: number;
  path: string[];
}

export interface ReviewNote {
  id: string;
  blockId: string;
  blockType: BlockType;
  startLine: number;
  endLine: number;
  headingPath: string[];
  originalMarkdown: string;
  selectedText?: string;
  instruction: string;
  expectedAction: ExpectedAction;
  priority: NotePriority;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedDocument {
  blocks: MarkdownBlock[];
  outline: OutlineItem[];
  totalLines: number;
}

export interface LoadedDocument {
  fileName: string;
  filePath: string;
  markdown: string;
  contentHash: string;
  totalLines: number;
  sourceFormat: SourceFormat;
  conversionMessages?: string[];
  html?: string;
  parsed?: ParsedDocument;
}

export interface FolderMarkdownFile {
  name: string;
  path: string;
  sourceFormat?: SourceFormat;
  handle?: FileSystemFileHandle;
}
