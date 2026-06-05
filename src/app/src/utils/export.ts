import type { LoadedDocument, ReviewNote } from '../types';
import { getBaseName } from './markdown';

export function buildAgentNotesJson(document: LoadedDocument, notes: ReviewNote[]) {
  return {
    schema: 'linjing.markdown-review-notes.v1',
    source: {
      fileName: document.fileName,
      filePath: document.filePath,
      sourceFormat: document.sourceFormat,
      contentHash: document.contentHash,
      totalLines: document.totalLines,
      conversionMessages: document.conversionMessages ?? [],
    },
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
    notes: notes.map((note, index) => ({
      index: index + 1,
      id: note.id,
      status: note.status,
      priority: note.priority,
      expectedAction: note.expectedAction,
      location: {
        blockId: note.blockId,
        blockType: note.blockType,
        startLine: note.startLine,
        endLine: note.endLine,
        headingPath: note.headingPath,
      },
      original: {
        markdown: note.originalMarkdown,
        selectedText: note.selectedText || null,
      },
      instruction: note.instruction,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
  };
}

function statusLabel(status: ReviewNote['status']) {
  const labels: Record<ReviewNote['status'], string> = {
    todo: '待处理',
    draft: '草稿',
    reviewed: '已复核',
    done: '已完成',
  };
  return labels[status];
}

function priorityLabel(priority: ReviewNote['priority']) {
  const labels: Record<ReviewNote['priority'], string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[priority];
}

function actionLabel(action: ReviewNote['expectedAction']) {
  const labels: Record<ReviewNote['expectedAction'], string> = {
    rewrite: '重写',
    expand: '补充',
    tighten: '压缩',
    verify: '核验',
    format: '调整格式',
    custom: '自定义',
  };
  return labels[action];
}

export function buildReviewMarkdown(document: LoadedDocument, notes: ReviewNote[]) {
  const lines: string[] = [];
  lines.push(`# ${getBaseName(document.fileName)} - 修改任务清单`);
  lines.push('');
  lines.push(`源文件：${document.fileName}`);
  lines.push(`源格式：${document.sourceFormat === 'docx' ? 'Word DOCX（HTML 排版还原视图）' : 'Markdown'}`);
  lines.push(`内容指纹：${document.contentHash}`);
  lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`修改点数量：${notes.length}`);
  lines.push('');

  if (notes.length === 0) {
    lines.push('暂无修改点。');
    return lines.join('\n');
  }

  notes.forEach((note, index) => {
    lines.push(`## 修改点 ${String(index + 1).padStart(3, '0')}`);
    lines.push('');
    lines.push(`- 状态：${statusLabel(note.status)}`);
    lines.push(`- 优先级：${priorityLabel(note.priority)}`);
    lines.push(`- 期望动作：${actionLabel(note.expectedAction)}`);
    lines.push(`- 原文位置：第 ${note.startLine}-${note.endLine} 行`);
    lines.push(`- 所属章节：${note.headingPath.length ? note.headingPath.join(' / ') : '未归入标题'}`);
    lines.push('');
    const fenceLabel = document.sourceFormat === 'docx' ? 'text' : 'markdown';
    lines.push('原文内容：');
    lines.push('');
    lines.push('```' + fenceLabel);
    lines.push(note.selectedText || note.originalMarkdown);
    lines.push('```');
    lines.push('');
    lines.push('修改建议：');
    lines.push('');
    lines.push(note.instruction.trim());
    lines.push('');
    lines.push('Agent 执行要求：');
    lines.push('');
    lines.push('请仅围绕上述原文位置处理，保留全文其他部分不变；若修改需要引用外部事实，请回源核验或标注待确认。');
    lines.push('');
  });

  return lines.join('\n');
}

export async function saveTextFile(contents: string, suggestedName: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: mimeType,
          accept: { [mimeType]: [suggestedName.slice(suggestedName.lastIndexOf('.'))] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
}
