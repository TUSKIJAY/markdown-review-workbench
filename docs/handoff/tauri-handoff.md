# Tauri 迁移交接说明

## 当前项目位置

```text
C:\Users\LENOVO\Desktop\工作\星际之门\林境售前workspace\项目\内部工具\Markdown文档审阅标注工作台
```

## 当前状态

已完成一个 React/Vite 版 Markdown 文档审阅标注工作台，支持构建为单文件 HTML：

```text
output/markdown-review-workbench.html
```

当前日常使用方式是直接打开该 HTML 文件，不需要启动服务。

## 已实现功能

- 打开单个 `.md` / `.markdown` 文件。
- 渲染 Markdown 预览。
- 自动生成标题大纲。
- 将标题、段落、列表、引用、代码块、表格等解析为可点击审阅块。
- 点击审阅块后在右侧填写修改建议。
- 修改建议输入后自动保存，不需要手动点击“保存当前标注”。
- 输入框为空或被清空时，不覆盖已有标注。
- 支持动作、优先级、状态字段。
- 标注保存到浏览器 `localStorage`。
- 支持导出：
  - `*.ai-notes.json`
  - `*.review.md`
- 已预留“打开文件夹”入口，纯 HTML 模式下受浏览器能力限制。

## 关键源码

```text
src/app/src/App.tsx
src/app/src/styles.css
src/app/src/types.ts
src/app/src/utils/markdown.ts
src/app/src/utils/export.ts
src/app/src/utils/storage.ts
src/app/scripts/build-single-html.mjs
```

## 已验证

- `npm run build` 通过。
- `npm run build:html` 通过。
- `file:///.../output/markdown-review-workbench.html` 模式验证通过。
- Playwright 验证点：
  - 单页 HTML 可加载。
  - 可读取 Markdown。
  - 输入修改建议后自动保存。
  - 清空输入框不会删除或覆盖已有标注。
  - JSON / Review 导出按钮可正常启用。
  - 控制台无错误。

## 当前痛点

纯 HTML 受浏览器沙箱限制：

- 不能自动在原 Markdown 同目录写入 `*.review.md` 和 `*.ai-notes.json`。
- 导出文件通常需要用户手动选择保存位置。
- 无法稳定长期持有文件夹权限。
- Agent 后续读取任务文件时，需要用户先导出。

## 下一步目标

迁移为 Tauri 桌面版，保留当前 React UI，同时通过 Tauri 后端突破文件读写限制。

目标体验：

1. 双击桌面应用启动。
2. 打开 Markdown 文件。
3. 读取真实本地路径。
4. 用户输入修改建议后自动保存标注。
5. 自动在原文同目录生成或更新：
   - `原文件名.ai-notes.json`
   - `原文件名.review.md`
6. 顶部仍保留手动导出按钮，但自动同步应成为主流程。
7. 后续 Agent 可直接读取同目录任务文件，无需用户每次手动导出。

## 建议技术路线

优先使用 Tauri v2 + 现有 React/Vite 项目。

建议步骤：

1. 在 `src/app/` 现有 Vite 项目基础上初始化 Tauri。
2. 增加 Tauri 文件打开能力：
   - 选择 `.md` 文件。
   - 返回文件名、绝对路径、文件内容。
3. 增加 Tauri 文件写入能力：
   - 根据原文路径生成同目录 `*.ai-notes.json` 和 `*.review.md`。
   - 标注变化后防抖自动同步。
4. 前端保留浏览器 fallback：
   - 如果运行在普通 HTML 环境，继续使用当前 File API + 手动导出。
   - 如果运行在 Tauri 环境，优先使用 Tauri 命令。
5. 增加同步状态提示：
   - `已自动保存`
   - `已同步任务文件`
   - `同步失败`
6. 完成 Windows 本地验证。

## Tauri 后端建议命令

可设计以下 command：

```text
open_markdown_file() -> { fileName, filePath, markdown, contentHash, totalLines }
write_review_files(sourcePath, aiNotesJson, reviewMarkdown) -> { aiNotesPath, reviewPath, updatedAt }
read_markdown_file(path) -> LoadedDocument
list_markdown_files(folderPath) -> FolderMarkdownFile[]
```

## 前端改造注意事项

- 不要破坏当前单文件 HTML 版本；它仍然作为跨系统 fallback。
- `saveTextFile()` 当前负责浏览器下载，Tauri 模式下应改为调用后端写文件。
- `loadFile()` 当前接收 `File`，Tauri 模式下需要新增从本地路径加载的分支。
- 自动保存标注逻辑已经在 `App.tsx` 中实现，可复用，在 `notes` 变化后追加“同步任务文件”的副作用。
- 自动同步必须防抖，避免每个键盘输入都写磁盘。
- 清空修改建议时不要覆盖已有任务文件里的标注，除非用户显式删除该标注。

## 推荐新 session 启动语

```text
请读取 docs/handoff/tauri-handoff.md，继续把 Markdown 文档审阅标注工作台迁移为 Tauri 桌面版。
目标是保留现有 React UI，同时让应用能自动在原 Markdown 同目录同步生成 .review.md 和 .ai-notes.json。
```
