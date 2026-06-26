# AGENTS.md

本文件是未来 Codex / Claude 接手本仓库的地图。它只放入口、边界、路由和验证线索；具体说明、SOP、交接和验收材料应放到 `docs/` 对应目录。

## 项目定位

`markdown-review-workbench` 是本地 Markdown / Word 文档审阅标注工作台。

- 人打开 `.md`、`.markdown`、`.docx`，按块添加审阅意见。
- 工具不直接改原文档，不接入在线 AI API。
- 审阅输出以 sidecar 为准：
  - `*.ai-notes.json`：给 Agent，schema 为 `linjing.markdown-review-notes.v1`
  - `*.review.md`：给人工复核

核心安全边界：任何功能都不能静默重写原 `.md` / `.docx`；自动同步也不能覆盖外部改过的 sidecar。

## 新会话入口

先运行 `git status --short`。如果工作区已有修改，默认保护它们；不要擅自 revert、reset 或覆盖。

按任务读取，不要一次性吞完整仓库：

- 功能 / Bug：`docs/handoff/session-handoff.md` + `docs/status/PROGRESS.md` 开头索引 + 相关源码
- 文档整理：`docs/README.md`
- 优化点收集：`docs/optimization/SOP.md`，未授权只记录、不改代码
- 绿色版 exe 刷新：`docs/packaging/绿色版更新SOP.md`
- 状态交接：先读 `docs/handoff/session-handoff.md`；历史细节看 `docs/status/PROGRESS.md`

## 根目录职责

根目录只应保留入口文件；执行细则逐步下沉到 `docs/`。

- `AGENTS.md`：Agent 接手地图，本文件。
- `README.md`：给人看的产品入口和使用说明。
- `Makefile`：根目录开发命令快捷入口。
- `docs/handoff/session-handoff.md`：当前接手 index，只保留最新状态、下一步、风险和关键指针。
- `docs/development/project-rules.md`：历史内部规则和维护边界。
- `docs/status/PROGRESS.md`：唯一历史 log 库 / 状态账本。
- `docs/packaging/绿色版更新SOP.md`：绿色版 exe 刷新 runbook。

根目录文档继续收敛时，先同步修正 `README.md`、本文件和 `docs/README.md` 中的路径。

## 任务路由

- 主流程 / 状态：`src/app/src/App.tsx`
- Markdown：`src/app/src/utils/markdown.ts`
- Word：`src/app/src/utils/word.ts`，指纹必须基于原始 `.docx` 字节
- 导出：`src/app/src/utils/export.ts`
- 存储 / 同步保护：`src/app/src/utils/storage.ts`
- Tauri 封装：`src/app/src/utils/tauri.ts`
- Rust 后端：`src/app/src-tauri/src/lib.rs`
- 项目文档：`docs/README.md`

## 仓库地图

```text
.
├── src/app/                 # React / Vite / Tauri 应用
├── src/app/src/             # 前端 TypeScript
├── src/app/src-tauri/       # Tauri v2 Rust 后端
├── docs/                    # product / development / packaging / status / handoff / acceptance / optimization / notes
├── assets/demo/             # README 截图和动图
├── output/                  # 本地构建产物和验证输出
├── archive/                 # 旧产物和归档材料，勿随意删除
├── Makefile                 # 根目录开发命令快捷入口
└── README.md                # 人类使用入口
```

## 硬规则

- 保持源文档安全模型：只生成 sidecar，不静默改原文。
- 保持浏览器 fallback；新增 Tauri 能力时不要破坏纯浏览器模式。
- 保持外部 sidecar 覆盖保护；自动同步不能吞掉外部改动。
- 保持中文优先、紧凑严肃的 UI 风格，适合技术方案、投标稿和内部文档。
- 不引入在线 AI API，除非用户明确改变项目范围。
- 不做无关重构，不清理未确认的旧产物，不移动或删除 `archive/`。
- 有意义的功能、修复、打包或验证工作结束后，更新 `docs/status/PROGRESS.md`；阶段结束或方向切换时刷新 `docs/handoff/session-handoff.md`。

## 常用命令

根目录有 `Makefile` 快捷入口；等价命令仍从 `src/app/` 执行。

```powershell
make dev
make build
make build-html
make tauri-build-no-bundle
```

底层 npm 命令：

```powershell
npm install
npm run dev -- --port 5174
npm run build
npm run build:html
npm run preview
npm run tauri:dev
```

验证桌面 release 或刷新绿色版前，先读 `docs/packaging/绿色版更新SOP.md`，再使用：

```powershell
make tauri-build-no-bundle
npm run tauri:build -- --no-bundle
```

## 验证与禁区

- 前端或共享逻辑：`npm run build`
- 单文件 HTML：`npm run build:html`
- Tauri / Rust：从 `src/app` 或 `src/app/src-tauri` 运行对应 build/check
- UI 行为：启动 dev server，用浏览器或 Tauri 按场景验证
- 交付说明写清：改了什么、跑了哪些验证、哪些没跑、下一步验收哪个路径

除非用户明确说“发版 / 打安装包 / 刷新 zip / 更新 archive”，不要运行完整打包、刷新 MSI/NSIS/zip、改 version、覆盖 `archive/`、复制到 `output/desktop/`。

刷新绿色版时只替换：

```text
output/portable/Markdown文档审阅标注工作台/Markdown文档审阅标注工作台.exe
```

并按 SOP 更新同目录 `version.txt`。
