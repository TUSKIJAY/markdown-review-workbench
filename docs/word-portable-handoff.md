# Word 兼容与绿色版交接说明

## 当前结论

先暂停“全量打安装包”的路线，改为：

1. 在现有源码基础上继续改功能。
2. 用开发态或绿色 exe 先验证功能。
3. 功能确认没问题后，再产出绿色版目录或 zip。
4. 安装包只作为可选交付，不作为当前主流程。

用户反馈：当前打开文件对话框仍只显示 `Markdown (*.md;*.markdown)`，无法选择 Word。截图显示的对话框大概率来自旧安装版或旧构建入口，不一定是当前源码中的最新逻辑。

## 项目位置

```text
C:\Users\LENOVO\Desktop\工作\星际之门\林境售前workspace\项目\内部工具\Markdown文档审阅标注工作台
```

前端和 Tauri 工程位置：

```text
src/app
```

## 当前源码状态

已做过的 Word 兼容改造：

- 前端新增 `mammoth` 依赖，用于 `.docx` 转 Markdown。
- 新增 `src/app/src/utils/word.ts`。
- `LoadedDocument` 增加：
  - `sourceFormat`
  - `conversionMessages`
- 导出的 `ai-notes.json` 增加 `source.sourceFormat` 和 `source.conversionMessages`。
- Tauri 后端新增：
  - `open_document_file`
  - `read_document_file`
  - `open_word_file`
  - `read_word_file`
- 文件夹扫描已改为识别：
  - `.md`
  - `.markdown`
  - `.docx`
- Word 文件不会被改写，只转换成 Markdown 审阅视图，标注任务文件仍写到原文件同目录。

关键文件：

```text
src/app/src/App.tsx
src/app/src/types.ts
src/app/src/utils/word.ts
src/app/src/utils/export.ts
src/app/src/utils/markdown.ts
src/app/src/utils/tauri.ts
src/app/src-tauri/src/lib.rs
src/app/src-tauri/tauri.conf.json
src/app/package.json
src/app/package-lock.json
```

## 已验证过

已运行并通过：

```powershell
npm run build
npm run build:html
npm run tauri:build
```

也做过一个最小 Word 样例转换验证，Mammoth 能把 `.docx` 标题和正文转换为 Markdown：

```text
# Word 兼容测试

这是从 Word 文档提取出的第一段正文。

## 二级标题

这里用于验证标注块、导出任务文件和同目录同步。
```

桌面 exe 做过启动冒烟检查，但尚未完成“用户真实打开 Word 文件”的端到端验证。

## 当前问题判断

用户看到的文件选择框仍为：

```text
Markdown (*.md;*.markdown)
```

这说明当前运行的程序仍在调用旧逻辑或旧版本：

- 可能打开的是之前安装过的旧安装版。
- 可能没有运行最新 `target/release/markdown-review-workbench.exe`。
- 可能开发态没有重启，仍在旧进程里。
- 也可能 Tauri 前端没有成功切到 `open_document_file` 命令，需要在开发态确认。

当前不建议继续反复打 MSI/NSIS 安装包验证，因为安装版会引入版本覆盖、缓存、旧快捷方式等干扰。

## 下一步推荐流程

### 1. 先清理旧运行进程

```powershell
Get-Process markdown-review-workbench -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 2. 用开发态验证

在 `src/app` 目录执行：

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run tauri:dev
```

验证点：

- 点击“打开文档”。
- 文件类型下拉应能看到包含 Word 或文档的筛选项。
- 能选择 `.docx`。
- 选择后页面显示 Word 转换出的正文内容。
- 能点击段落添加修改建议。
- 标注后自动在原 `.docx` 同目录生成：
  - `原文件名.ai-notes.json`
  - `原文件名.review.md`

### 3. 如开发态仍只显示 Markdown

优先检查 `src/app/src/App.tsx`：

- import 是否为 `openDocumentFileWithTauri`。
- `openMarkdownFile()` 内 Tauri 分支是否调用：

```ts
const document = await openDocumentFileWithTauri();
await loadSourceDocument(document);
```

再检查 `src/app/src-tauri/src/lib.rs`：

- `open_document_file` 是否存在。
- 是否使用：

```rust
.add_filter("文档", &["md", "markdown", "docx"])
```

- `generate_handler!` 是否包含：

```rust
open_document_file,
read_document_file,
```

### 4. 再做绿色版

功能确认后，不优先产出安装包。优先产出绿色版：

```text
output/portable/Markdown文档审阅标注工作台/
```

建议绿色版内容：

```text
Markdown文档审阅标注工作台/
├── Markdown文档审阅标注工作台.exe
├── README.md
└── version.txt
```

Tauri 当前 release exe 路径：

```text
src/app/src-tauri/target/release/markdown-review-workbench.exe
```

该 exe 理论上可以作为绿色版主程序。用户电脑通常只需要 WebView2 Runtime；Windows 10/11 大多数机器已有。

建议复制并改名：

```powershell
$project = "C:\Users\LENOVO\Desktop\工作\星际之门\林境售前workspace\项目\内部工具\Markdown文档审阅标注工作台"
$portable = Join-Path $project "output\portable\Markdown文档审阅标注工作台"
New-Item -ItemType Directory -Force -Path $portable | Out-Null
Copy-Item -LiteralPath (Join-Path $project "src\app\src-tauri\target\release\markdown-review-workbench.exe") -Destination (Join-Path $portable "Markdown文档审阅标注工作台.exe") -Force
```

确认绿色 exe 能打开 Word 后，再压缩：

```powershell
Compress-Archive -LiteralPath $portable -DestinationPath (Join-Path $project "output\portable\Markdown文档审阅标注工作台-portable.zip") -Force
```

## 绿色版优先的原因

- 不需要安装和卸载。
- 避免旧安装包、旧快捷方式、版本覆盖造成混淆。
- 方便发给同事试用。
- 修改后只需要替换 exe 或重新发 zip。
- 当前工具是内部审阅工具，绿色版更符合试用阶段。

## 暂缓事项

以下事项先不做，等 Word 打开和标注流程稳定后再考虑：

- MSI / NSIS 安装包优化。
- 自动更新。
- 写回原 Word。
- Word 原文定位到真实页码/段落编号。
- 保留 Word 原样版式预览。

## 推荐新 session 启动语

```text
请读取 docs/word-portable-handoff.md，继续在现有源码基础上修复 Word 打开流程。
先用 npm run tauri:dev 验证 .docx 能选择和转换，不要急着打安装包。
功能确认后产出绿色版 output/portable/Markdown文档审阅标注工作台-portable.zip。
```
