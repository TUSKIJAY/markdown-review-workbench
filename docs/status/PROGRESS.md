# PROGRESS.md

本文件是项目历史 log 库 / 状态账本，只维护这一份长期累积版本。

- 当前接手入口：`docs/handoff/session-handoff.md`
- 项目入口规则：`AGENTS.md`
- 稳定知识库索引：`docs/README.md`

## Current Snapshot

- 更新时间：2026-06-26
- 当前产品状态：V0.3 已支持 Word `.docx` 兼容导入；React/Vite 浏览器版本、单文件 HTML fallback 和 Tauri Windows 桌面版均可用。
- 当前文档状态：根目录已收敛为入口层，`AGENTS.md` 管项目地图，`docs/handoff/session-handoff.md` 管当前接手，本文管历史 log。
- 当前验证状态：本轮为文档结构改造，未运行应用构建；本机未发现 `make` / `mingw32-make` / `nmake`。
- 当前主要风险：工作区已有未提交源码改动，后续任务必须先 `git status --short` 并保护既有改动。

## Feature Status Index

| 模块 / 能力 | 当前状态 | 历史入口 |
|---|---|---|
| Markdown / Word 审阅标注 | 可用，Word `.docx` 走 HTML 预览与块级标注 | `2026-05-18`、`2026-06-06`、`2026-06-17` 记录 |
| Sidecar 输出与同步保护 | 可用，输出 `*.ai-notes.json` / `*.review.md`，自动同步有外部覆盖保护 | `2026-06-06` 记录 |
| Markdown 相对图片预览 | 已修复浏览器提示、桌面同目录图片读取 | `2026-06-17` 记录 |
| 右侧标注面板布局 | 已完成三段式布局与多视口检查 | `2026-06-17` 记录 |
| 绿色版 exe 刷新 | 仅允许按 SOP 刷新 portable exe，禁止默认打包 MSI/NSIS/zip | `docs/packaging/绿色版更新SOP.md` |
| 根目录 harness | 已收敛为 `AGENTS.md` / `README.md` / `Makefile` | `2026-06-26` 记录 |
| 状态文档模型 | `session-handoff.md` 管当前接手，本文管历史账本 | `2026-06-26` 记录 |

## Decision Index

| 决策 | 当前口径 | 指针 |
|---|---|---|
| 根目录纪律 | 根目录只放入口文件和轻量命令入口，执行细则下沉到 `docs/` | `AGENTS.md`、`docs/README.md` |
| 状态文档分工 | `session-handoff.md` 是最新接手 index；`PROGRESS.md` 是历史 log 库 | `docs/handoff/session-handoff.md` |
| 源文档安全模型 | 不静默重写原 `.md` / `.docx`，sidecar 是审阅输出 | `AGENTS.md` |
| 绿色版验收 | 日常只构建 `--no-bundle` release 并覆盖 portable exe | `docs/packaging/绿色版更新SOP.md` |
| 优化记录模式 | 优化点先记录，未授权不改代码 | `docs/optimization/SOP.md` |
| 在线 AI API | 第一版不接入在线 AI API | `AGENTS.md`、`docs/development/project-rules.md` |

## Risk / Blocker Index

| 风险 / 阻塞 | 状态 | 处理方式 |
|---|---|---|
| Dirty worktree | 存在前序源码与文档改动 | 先看 `git status --short`，不要 revert 未确认改动 |
| `make` 不可用 | 本机当前未找到 make 工具 | Makefile 可静态维护；需要执行时先安装 make 或继续用 npm 命令 |
| 完整打包误触发 | MSI/NSIS/zip 不属于日常验收 | 只用 `npm run tauri:build -- --no-bundle` 或 `make tauri-build-no-bundle` |
| 历史状态变长 | 本文件会长期累积 | 只在开头维护索引；handoff 只写当前接手，不塞历史细节 |

## History Log

### Rolling Status Board（滚动状态区）

V0.3 已支持 Word `.docx` 兼容导入。React/Vite 浏览器版本、单文件 HTML fallback 和 Tauri Windows 桌面打包均可用；Tauri 桌面版可读取真实路径，并在原文档同目录同步任务文件。

### In Progress（进行中）

- 暂停安装包优先路线，先在源码/开发态修复并验证 Word `.docx` 打开流程。
- 功能确认后优先刷新绿色版 exe：`output/portable/Markdown文档审阅标注工作台/Markdown文档审阅标注工作台.exe`。

### To Do（待办）

- [ ] 评估并实施 Tauri 桌面版迁移
- [ ] 增加原文定点替换预览
- [ ] 支持导入历史 `ai-notes.json`
- [ ] 增加标注筛选和批量状态变更
- [ ] 支持把标注以内嵌注释形式写回 Markdown 副本

### Completed（已完成）

- [x] 2026-06-26 — 更新 GitHub 首页 `README.md`：首屏前移“当前仓库入口”，明确 `docs/README.md`、`AGENTS.md`、`docs/handoff/session-handoff.md`、`docs/status/PROGRESS.md`；同时说明绿色版属于内部分发产物、不随源码仓库提交。
- [x] 2026-06-26 — 状态文档模型改造：新增 `docs/handoff/session-handoff.md` 作为当前接手 index；`docs/status/PROGRESS.md` 改为唯一历史 log 库，并在开头补 `Current Snapshot`、`Feature Status Index`、`Decision Index`、`Risk / Blocker Index`；同步更新 `AGENTS.md` 与 `docs/README.md` 的状态文档入口。
- [x] 2026-06-26 — 根目录新增 `Makefile` 作为开发快捷入口，代理 `src/app` 下的 install/dev/build/build-html/preview/tauri-dev/tauri-build-no-bundle；不提供完整打包目标，避免误刷 MSI/NSIS。
- [x] 2026-06-26 — 根目录文档按 harness 思路收敛：`AGENTS.md` 改为中文 Agent 接手地图；`INSTRUCTIONS.md` 下沉为 `docs/development/project-rules.md`；`PROGRESS.md` 下沉为 `docs/status/PROGRESS.md`；`SOP-绿色版更新.md` 下沉为 `docs/packaging/绿色版更新SOP.md`；同步更新 `README.md` 与 `docs/README.md` 的文档入口。
- [x] 2026-06-17 — 按 `SOP-绿色版更新.md` 刷新绿色版 exe：执行 `npm run tauri:build -- --no-bundle`，只覆盖 `output/portable/Markdown文档审阅标注工作台/Markdown文档审阅标注工作台.exe` 并更新同目录 `version.txt`；本次绿色版包含右侧标注面板三段式布局、表格批注空白高亮修复、Markdown 相对图片桌面版预览支持。未生成 MSI/NSIS，未刷新 portable zip，未改版本号，未动 archive。
- [x] 2026-06-17 — 补充 Markdown 相对图片的浏览器单文件模式提示：相对图片在无目录权限时不再显示破图图标，改为显示“浏览器单文件模式无法读取同目录图片，请用打开文件夹”的占位说明；已用 Playwright 复现 `OPT-001-1.png` / `images/OPT-001-2.png` 相对路径场景，验证 `brokenImages = 0`、无横向溢出。
- [x] 2026-06-17 — 修复表格选中批注与 Markdown 图片预览问题：跨表格选区高亮跳过纯空白文本节点，避免表格左上角出现空白高亮块；Markdown 图片渲染支持安全的 data/blob 地址，浏览器文件夹模式可读取同目录/子目录相对图片，Tauri 桌面模式新增受限只读图片命令用于同目录相对图片预览。已验证 `npm run build`、`cargo check`，并用 Playwright 验证整表批注无空标记、Markdown 图片可加载、无横向溢出；按要求未刷新绿色版 exe、未打包。
- [x] 2026-06-17 — 改进右侧标注面板拥挤问题：新增“选中内容 / 当前标注 / 修改点”三段式受控布局，原文展开与修改点展开互斥；默认态原文仅保留摘要、修改点仅显示最近 2 条，编辑区保持主工作区并内部滚动。已验证 `npm run build`，并用 Playwright 在 1918x982、1366x768、390x900 检查默认态、展开原文、展开修改点、再次收起与无横向溢出；按要求未刷新绿色版 exe、未打包。
- [x] 2026-06-17 — 修复右侧标注面板在中等高度视口下挤掉“修改点”列表的问题：编辑区改为可压缩并内部滚动，底部修改点区域保留稳定可见高度；已用 1918x982 桌面视口创建 3 条修改点验证全部可见，并补测 390x900 移动端无横向溢出。
- [x] 2026-06-17 — 修复长文件名/长标题在不同分辨率下撑破中间工作区的问题：顶栏与文档区允许在 grid/flex 内收缩，预览内容按父容器宽度布局，Markdown/Word 正文长词、代码块、表格、源码视图支持断行；已用 2048x1200、1366x768、390x900 Playwright 冒烟验证，无横向溢出或右侧面板遮挡。
- [x] 2026-06-17 — 实施 `docs/optimization/2026-06-17/2026-06-17-优化清单.md`：支持预览区持久片段标记、同块多条片段级批注、Markdown 非破坏式 sidecar 修订（替换/删除/插入），导出增加 `selectionRange`、`revision` 与 `changes`。已验证 `npm run build`、`npm run build:html` 与浏览器冒烟测试；按要求未打包 exe。
- [x] 2026-06-17 — 学习 `D:\Code\quote-system-acm-refactor\docs\optimization\SOP.md` 与 `template-优化清单.md`，为本项目新增 `docs/optimization/SOP.md` 和 `docs/optimization/template-优化清单.md`，建立“优化点先记录、实施另行确认”的批次管理流程。
- [x] 2026-06-17 — 整理 `docs/` 文档结构：参考 `D:\Code\quote-system-acm-refactor\docs` 的“根 README 索引 + 按用途分目录”模式，新增 `docs/README.md`，将产品蓝图移入 `docs/product/`，开发使用说明移入 `docs/development/`，Tauri 与 Word 绿色版交接移入 `docs/handoff/`，并预留 `docs/acceptance/` 与 `docs/notes/`。
- [x] 2026-05-14 — 项目初始化，目录结构已创建
- [x] 2026-05-14 — 完成 React/Vite 应用搭建与依赖安装
- [x] 2026-05-14 — 完成 Markdown 读取、预览、大纲、块选中和标注保存
- [x] 2026-05-14 — 完成 `ai-notes.json` 与 `review.md` 导出
- [x] 2026-05-14 — 完成桌面和移动端浏览器验证
- [x] 2026-05-14 — 新增单文件 HTML 构建脚本，支持无需启动服务直接使用
- [x] 2026-05-14 — 完成 `file:///` 模式验证：页面加载、Markdown 读取、标注保存、导出按钮启用
- [x] 2026-05-14 — 将单条标注改为输入后自动保存，清空输入时不覆盖已有标注
- [x] 2026-05-14 — 编写 Tauri 迁移交接说明
- [x] 2026-05-14 — 新增 Tauri v2 工程骨架、桌面端文件读写命令和 npm 脚本
- [x] 2026-05-14 — 前端接入 Tauri runtime 探测：桌面端优先使用真实路径读写，浏览器端保留 File API 与手动导出 fallback
- [x] 2026-05-14 — 增加标注变化后的防抖自动同步：生成或更新同目录 `.ai-notes.json` 与 `.review.md`
- [x] 2026-05-14 — 验证 `npm run build`、`npm run build:html` 与本地浏览器首屏交互；当前 Tauri 原生编译阻塞于本机缺少 Rust/Cargo/MSVC
- [x] 2026-05-14 — 安装 Rust/Cargo/rustup 与 Visual Studio Build Tools C++ 工具链，`npm run tauri -- info` 环境检查通过
- [x] 2026-05-14 — 修复 Tauri 打包图标与 WiX 中文代码页配置，成功生成 MSI 与 NSIS 安装包
- [x] 2026-05-14 — 将安装包复制到 `output/desktop/`，并完成 Tauri 可执行文件启动冒烟检查
- [x] 2026-05-14 — 新增 Word `.docx` 导入能力：通过 Mammoth 转换为 Markdown 审阅视图，保留原 Word 文件不变
- [x] 2026-05-14 — Tauri 后端新增 Word 二进制读取与通用文档打开命令，文件夹模式支持 `.md` / `.markdown` / `.docx`
- [x] 2026-05-14 — 导出任务文件增加 `sourceFormat` 与转换提示字段，Word 标注可追溯到原 `.docx`
- [x] 2026-05-14 — 验证 Word 样例转换、`npm run build`、`npm run build:html`、`npm run tauri:build`、桌面 exe 启动和浏览器首屏交互
- [x] 2026-05-14 — 根据用户反馈，记录 Word 文件选择框仍显示 Markdown 筛选的问题，新增绿色版交接说明（现归档于 `docs/handoff/word-portable-handoff.md`）
- [x] 2026-05-18 — Word 排版还原：`word.ts` 改用 mammoth `convertToHtml`，新增 `parseWordHtml` 按顶层 DOM 切块；`App.tsx` 渲染走 Word 专属分支并复用块级标注；`styles.css` 增加 A4 风格 `.word-page` / `.word-body` 样式（表格、列表、标题、图片、引用、超链接）。已知限制：不保段落对齐、字号字体、页眉页脚、分栏。
- [x] 2026-05-18 — 新增 SOP-绿色版更新.md，约定每次迭代只刷绿色版 exe 验收，不打 MSI/NSIS、不动 zip 与 archive、不改 version 字段。
- [x] 2026-05-18 — 新增 `utils/recent.ts` 存最近打开列表（localStorage，cap 12 条）；`App.tsx` 在 `loadDocument` 中记录、左栏与欢迎页展示列表、Tauri 启动时自动重开列表里第一条可访问的文件，读不到就静默从列表移除；`styles.css` 新增 recent-list 与 empty-recent 样式。
- [x] 2026-05-18 — 试用前最后扫雷：(1) `word.ts` DOMPurify 增加 `ADD_DATA_URI_TAGS: ['img']`，修复 Word 嵌入图片被剥 src 导致空白；(2) `export.ts` 修正 review.md 中 docx 来源描述（HTML 排版还原视图）与代码围栏标签（docx 走 ```text）；(3) `App.tsx` 顶栏"保存"按钮在 Tauri 模式下触发立即同步而不是只弹 toast，浏览器模式提示词保留；(4) `loadFile` / `loadSourceDocument` / 文件夹点击 / 文件输入器加上错误捕获，转换失败统一 toast；(5) Word 转换前先 yield 一帧并显示"正在转换 Word..."提示。
- [x] 2026-06-05 — 整理 GitHub 发布资料：新增 `.gitignore`，重写 README，生成 `assets/demo/` 下桌面、Word、小屏截图与 workflow GIF 动图。
- [x] 2026-06-06 — P0 数据可靠性修复（macOS 源码侧，不含 portable 打包，留 Windows）：
  - 标注丢失链：存储键从"文件名+内容指纹"改为"文件路径/文件名"（`storage.ts` `buildStorageKey`），存储结构升级为 `{version,contentHash,notes}` 并兼容旧数组；原文内容变更不再丢标注，重开时比对指纹、漂移则 toast 提示（`App.tsx` `loadDocument`）。
  - Word 假行号：`export.ts` review.md 对 docx 改"第 N 块"并注明行号不适用，`ai-notes` 的 `location` 增加 `unit:'line'|'block'` 字段（schema v1 向后兼容增量）。
  - docx 指纹：改用原始字节计算（`markdown.ts` 新增 `createContentHashFromBytes`，`word.ts` 不再用转换后 HTML），mammoth 升级不再导致指纹漂移。
  - sidecar 覆盖保护：新增 Rust `read_review_files` 命令 + 前端同步基线（`storage.ts` `loadSyncBaseline/storeSyncBaseline`）；自动同步检测到 sidecar 被外部修改则暂停并提示，手动"保存"视为明确覆盖（`App.tsx` `syncReviewFilesToDisk`）。
  - 清理：删 `tauri.ts` 5 个死函数 + `lib.rs` 5 个死命令；防抖时长 550/850/2600 提为具名常量。
  - 验收：`tsc --noEmit` + `vite build` 通过；Playwright E2E 18/18 PASS（MD/DOCX 加载标注导出、#1 变更不丢+提示、unit 字段、字节指纹）；Rust 改动人工核对通过，`cargo check` 与真机 exe 留 Windows 侧。
