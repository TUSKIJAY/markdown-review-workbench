import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { MarkdownBlock, OutlineItem, BlockType } from '../types';

marked.use({
  gfm: true,
  breaks: false,
});

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const fencePattern = /^\s*(```|~~~)/;
const rulePattern = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const listPattern = /^\s{0,3}([-*+]\s+|\d+[.)]\s+)/;
const quotePattern = /^\s{0,3}>\s?/;
const tableSeparatorPattern = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function normalizeLineEndings(markdown: string) {
  return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isBlank(line: string) {
  return line.trim().length === 0;
}

function isTableStart(lines: string[], index: number) {
  return lines[index]?.includes('|') && tableSeparatorPattern.test(lines[index + 1] ?? '');
}

function isStructuralStart(lines: string[], index: number) {
  const line = lines[index] ?? '';
  return (
    headingPattern.test(line) ||
    fencePattern.test(line) ||
    rulePattern.test(line) ||
    listPattern.test(line) ||
    quotePattern.test(line) ||
    isTableStart(lines, index)
  );
}

function blockTypeLabel(line: string, lines: string[], index: number): BlockType {
  if (headingPattern.test(line)) return 'heading';
  if (fencePattern.test(line)) return 'code';
  if (rulePattern.test(line)) return 'rule';
  if (quotePattern.test(line)) return 'quote';
  if (listPattern.test(line)) return 'list';
  if (isTableStart(lines, index)) return 'table';
  return 'paragraph';
}

function stripMarkdown(source: string) {
  return source
    .replace(/```[\s\S]*?```/g, '代码块')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}([-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function updateHeadingStack(stack: string[], level: number, title: string) {
  const next = stack.slice(0, Math.max(level - 1, 0));
  next[level - 1] = title;
  return next;
}

export function parseMarkdown(markdown: string) {
  const normalized = normalizeLineEndings(markdown);
  const lines = normalized.split('\n');
  const blocks: MarkdownBlock[] = [];
  const outline: OutlineItem[] = [];
  let headingStack: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isBlank(lines[i])) {
      i += 1;
      continue;
    }

    const start = i;
    const type = blockTypeLabel(lines[i], lines, i);
    let end = i;
    let headingLevel: number | undefined;

    if (type === 'code') {
      const fence = lines[i].trim().slice(0, 3);
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        i += 1;
      }
      end = Math.min(i, lines.length - 1);
      i = end + 1;
    } else if (type === 'heading') {
      const match = lines[i].match(headingPattern);
      const title = match?.[2]?.trim() ?? lines[i].replace(/^#+\s*/, '').trim();
      headingLevel = match?.[1]?.length ?? 1;
      headingStack = updateHeadingStack(headingStack, headingLevel, title);
      end = i;
      i += 1;
    } else if (type === 'table') {
      i += 2;
      while (i < lines.length && lines[i].includes('|') && !isBlank(lines[i])) {
        i += 1;
      }
      end = i - 1;
    } else if (type === 'list') {
      i += 1;
      while (i < lines.length && !isBlank(lines[i]) && !headingPattern.test(lines[i]) && !fencePattern.test(lines[i])) {
        i += 1;
      }
      end = i - 1;
    } else if (type === 'quote') {
      i += 1;
      while (i < lines.length && quotePattern.test(lines[i])) {
        i += 1;
      }
      end = i - 1;
    } else if (type === 'rule') {
      end = i;
      i += 1;
    } else {
      i += 1;
      while (i < lines.length && !isBlank(lines[i]) && !isStructuralStart(lines, i)) {
        i += 1;
      }
      end = i - 1;
    }

    const raw = lines.slice(start, end + 1).join('\n');
    const block: MarkdownBlock = {
      id: `block-${blocks.length + 1}-${start + 1}-${end + 1}`,
      index: blocks.length,
      type,
      raw,
      plain: stripMarkdown(raw),
      startLine: start + 1,
      endLine: end + 1,
      headingPath: [...headingStack],
      headingLevel,
    };

    blocks.push(block);

    if (type === 'heading') {
      outline.push({
        id: block.id,
        title: block.plain,
        level: headingLevel ?? 1,
        line: block.startLine,
        path: [...block.headingPath],
      });
    }
  }

  return { blocks, outline, totalLines: lines.length };
}

export function renderMarkdownHtml(markdown: string) {
  const html = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

export function createContentHash(source: string) {
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getBaseName(fileName: string) {
  return fileName.replace(/\.(md|markdown|docx)$/i, '');
}
