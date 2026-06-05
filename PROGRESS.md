# Progress

## Current Status（当前状态）

V0.3 已支持 Word `.docx` 兼容导入。React/Vite 浏览器版本、单文件 HTML fallback 和 Tauri Windows 桌面打包均可用；Tauri 桌面版可读取真实路径，并在原文档同目录同步任务文件。

## In Progress（进行中）

- 暂停安装包优先路线，先在源码/开发态修复并验证 Word `.docx` 打开流程。
- 功能确认后优先产出绿色版 `output/portable/Markdown文档审阅标注工作台-portable.zip`。

## To Do（待办）

- [ ] 评估并实施 Tauri 桌面版迁移
- [ ] 增加原文定点替换预览
- [ ] 支持导入历史 `ai-notes.json`
- [ ] 增加标注筛选和批量状态变更
- [ ] 支持把标注以内嵌注释形式写回 Markdown 副本

## Completed（已完成）

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
- [x] 2026-05-14 — 根据用户反馈，记录 Word 文件选择框仍显示 Markdown 筛选的问题，新增绿色版交接说明 `docs/word-portable-handoff.md`
- [x] 2026-05-18 — Word 排版还原：`word.ts` 改用 mammoth `convertToHtml`，新增 `parseWordHtml` 按顶层 DOM 切块；`App.tsx` 渲染走 Word 专属分支并复用块级标注；`styles.css` 增加 A4 风格 `.word-page` / `.word-body` 样式（表格、列表、标题、图片、引用、超链接）。已知限制：不保段落对齐、字号字体、页眉页脚、分栏。
- [x] 2026-05-18 — 新增 SOP-绿色版更新.md，约定每次迭代只刷绿色版 exe 验收，不打 MSI/NSIS、不动 zip 与 archive、不改 version 字段。
- [x] 2026-05-18 — 新增 `utils/recent.ts` 存最近打开列表（localStorage，cap 12 条）；`App.tsx` 在 `loadDocument` 中记录、左栏与欢迎页展示列表、Tauri 启动时自动重开列表里第一条可访问的文件，读不到就静默从列表移除；`styles.css` 新增 recent-list 与 empty-recent 样式。
- [x] 2026-05-18 — 试用前最后扫雷：(1) `word.ts` DOMPurify 增加 `ADD_DATA_URI_TAGS: ['img']`，修复 Word 嵌入图片被剥 src 导致空白；(2) `export.ts` 修正 review.md 中 docx 来源描述（HTML 排版还原视图）与代码围栏标签（docx 走 ```text）；(3) `App.tsx` 顶栏"保存"按钮在 Tauri 模式下触发立即同步而不是只弹 toast，浏览器模式提示词保留；(4) `loadFile` / `loadSourceDocument` / 文件夹点击 / 文件输入器加上错误捕获，转换失败统一 toast；(5) Word 转换前先 yield 一帧并显示"正在转换 Word..."提示。
- [x] 2026-06-05 — 整理 GitHub 发布资料：新增 `.gitignore`，重写 README，生成 `assets/demo/` 下桌面、Word、小屏截图与 workflow GIF 动图。
