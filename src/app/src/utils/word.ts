import DOMPurify from 'dompurify';
import type {
  BlockType,
  LoadedDocument,
  MarkdownBlock,
  OutlineItem,
  ParsedDocument,
  SourceFormat,
} from '../types';
import { createContentHash } from './markdown';

type MammothModule = {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: Record<string, unknown>): Promise<{
    value: string;
    messages: Array<{ message?: string; type?: string }>;
  }>;
};

const docxStyleMap = [
  "p[style-name='Title'] => h1.docx-title:fresh",
  "p[style-name='Subtitle'] => h2.docx-subtitle:fresh",
  "p[style-name='标题'] => h1:fresh",
  "p[style-name='标题 1'] => h1:fresh",
  "p[style-name='标题 2'] => h2:fresh",
  "p[style-name='标题 3'] => h3:fresh",
  "p[style-name='标题 4'] => h4:fresh",
  "p[style-name='标题 5'] => h5:fresh",
  "p[style-name='标题 6'] => h6:fresh",
  "p[style-name='正文'] => p:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote.docx-intense:fresh",
  "p[style-name='引文'] => blockquote:fresh",
  "p[style-name='caption'] => p.docx-caption:fresh",
  "p[style-name='题注'] => p.docx-caption:fresh",
  "p[style-name='TOC Heading'] => p.docx-toc-heading:fresh",
  "p[style-name='目录'] => p.docx-toc:fresh",
  "p[style-name^='toc '] => p.docx-toc:fresh",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Strong'] => strong",
  "r[style-name='Hyperlink'] => a",
];

const headingTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const listTags = new Set(['UL', 'OL']);

export function getSourceFormatFromName(fileName: string): SourceFormat | null {
  if (/\.(md|markdown)$/i.test(fileName)) return 'markdown';
  if (/\.docx$/i.test(fileName)) return 'docx';
  return null;
}

export function isReviewableDocumentName(fileName: string) {
  return Boolean(getSourceFormatFromName(fileName));
}

export function arrayBufferFromBase64(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function elementToBlockType(element: Element): BlockType {
  const tag = element.tagName.toUpperCase();
  if (headingTags.has(tag)) return 'heading';
  if (listTags.has(tag)) return 'list';
  if (tag === 'TABLE') return 'table';
  if (tag === 'BLOCKQUOTE') return 'quote';
  if (tag === 'HR') return 'rule';
  if (tag === 'PRE') return 'code';
  return 'paragraph';
}

function getHeadingLevel(element: Element): number | undefined {
  const match = element.tagName.match(/^H([1-6])$/i);
  return match ? Number(match[1]) : undefined;
}

function normaliseText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function elementToPlainText(element: Element): string {
  const tag = element.tagName.toUpperCase();

  if (tag === 'TABLE') {
    const rows = Array.from(element.querySelectorAll('tr')).map((row) =>
      Array.from(row.children)
        .map((cell) => normaliseText(cell.textContent ?? ''))
        .join(' | '),
    );
    return rows.join('\n');
  }

  if (tag === 'UL' || tag === 'OL') {
    const items = Array.from(element.children).filter((child) => child.tagName === 'LI');
    return items
      .map((item, index) => {
        const bullet = tag === 'OL' ? `${index + 1}.` : '-';
        return `${bullet} ${normaliseText(item.textContent ?? '')}`;
      })
      .join('\n');
  }

  return normaliseText(element.textContent ?? '');
}

function updateHeadingStack(stack: string[], level: number, title: string) {
  const next = stack.slice(0, Math.max(level - 1, 0));
  next[level - 1] = title;
  return next;
}

function sanitiseHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
    ADD_DATA_URI_TAGS: ['img'],
  });
}

export function parseWordHtml(html: string): { html: string; parsed: ParsedDocument } {
  const sanitised = sanitiseHtml(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${sanitised}</body></html>`, 'text/html');
  const bodyChildren = Array.from(doc.body.children);

  const blocks: MarkdownBlock[] = [];
  const outline: OutlineItem[] = [];
  let headingStack: string[] = [];

  bodyChildren.forEach((element, index) => {
    const type = elementToBlockType(element);
    const headingLevel = type === 'heading' ? getHeadingLevel(element) : undefined;
    const plain = elementToPlainText(element);
    const startLine = index + 1;
    const endLine = startLine;

    if (type === 'heading' && headingLevel) {
      headingStack = updateHeadingStack(headingStack, headingLevel, plain);
    }

    const blockHtml = element.outerHTML;
    const block: MarkdownBlock = {
      id: `block-${index + 1}-${startLine}-${endLine}`,
      index,
      type,
      raw: plain || blockHtml,
      plain,
      startLine,
      endLine,
      headingPath: [...headingStack],
      headingLevel,
      html: blockHtml,
    };

    blocks.push(block);

    if (type === 'heading' && headingLevel) {
      outline.push({
        id: block.id,
        title: plain,
        level: headingLevel,
        line: startLine,
        path: [...headingStack],
      });
    }
  });

  return {
    html: sanitised,
    parsed: {
      blocks,
      outline,
      totalLines: blocks.length,
    },
  };
}

export async function convertWordToDocument(fileName: string, filePath: string, arrayBuffer: ArrayBuffer) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default as unknown as MammothModule;
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: docxStyleMap,
      includeDefaultStyleMap: true,
      includeEmbeddedStyleMap: true,
    },
  );

  const rawHtml = result.value.trim() || '<p>Word 文档未提取到正文内容。</p>';
  const { html, parsed } = parseWordHtml(rawHtml);
  const messages = result.messages
    .map((message) => [message.type, message.message].filter(Boolean).join(': '))
    .filter(Boolean);

  const document: LoadedDocument = {
    fileName,
    filePath,
    markdown: '',
    contentHash: createContentHash(html),
    totalLines: parsed.totalLines,
    sourceFormat: 'docx',
    conversionMessages: messages,
    html,
    parsed,
  };

  return document;
}
