# 项目维护规则

本文件承接原根目录 `INSTRUCTIONS.md` 的内部维护约束。面向未来 Agent 的入口规则以根目录 `AGENTS.md` 为准；这里只保留不适合放在入口地图里的背景边界。

## 项目目标

构建一个本地桌面 / 浏览器工具，用于打开 Markdown 和 Word `.docx` 文档、直观审阅内容、对指定段落或文本块添加修改建议，并导出 Agent 可读取的结构化修改任务文件。

## 维护边界

- 前端应用统一在 `src/app/`。
- 根目录只放入口文件；执行细则、SOP、状态、交接和验收材料放进 `docs/`。
- 完成重要功能、修复、打包或验证后，更新 `docs/status/PROGRESS.md`；阶段结束、任务中断或方向切换时刷新 `docs/handoff/session-handoff.md`。
- 被替代的重要材料优先移入合适的 `docs/` 分区；旧产物和历史构建不要随意删除。
- 第一版范围不接入在线 AI API。
- 默认不污染原 Markdown / Word 文档，标注导出为 sidecar 文件。
- UI 需要适合投标文件、技术方案、内部资料等严肃文档审阅场景。

## 文档位置

- Agent 入口：`AGENTS.md`
- 人类产品入口：`README.md`
- 文档索引：`docs/README.md`
- 当前接手：`docs/handoff/session-handoff.md`
- 当前状态：`docs/status/PROGRESS.md`
- 绿色版更新：`docs/packaging/绿色版更新SOP.md`
- 优化记录：`docs/optimization/SOP.md`
