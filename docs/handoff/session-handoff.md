# session-handoff.md

本文件是当前接手 index，只维护最新版本。它回答“下一轮怎么接手”，不记录完整历史；历史细节看 `docs/status/PROGRESS.md`。

## Current Snapshot

- 更新时间：2026-06-26
- 当前阶段：项目 harness / 文档状态层正在收敛，根目录已调整为入口层。
- 当前根目录入口：`AGENTS.md`、`README.md`、`Makefile`。
- 当前状态账本：`docs/status/PROGRESS.md`。
- 当前稳定知识库入口：`docs/README.md`。
- 本轮文档改造未触碰应用源码；仓库里仍有前序源码 dirty state，需要继续保护。

## Next Steps

1. 复核并接受状态文档分工：`session-handoff.md` 管当前接手，`PROGRESS.md` 管历史 log。
2. 如果继续文档 harness，优先检查 `docs/README.md` 的分类是否还需要把旧专项 handoff 归档或改名。
3. 如果切回功能开发，先读 `AGENTS.md`、本文件、`docs/status/PROGRESS.md` 开头索引，再按任务读取源码。
4. 如果要刷新绿色版 exe，先读 `docs/packaging/绿色版更新SOP.md`；不要默认打 MSI/NSIS/zip。

## Current Risks

- 工作区已有未提交改动，包含源码和文档；下一轮必须先运行 `git status --short`，不要擅自还原。
- 本机当前没有 `make` / `mingw32-make` / `nmake`，Makefile 目标未实际执行过；可继续使用底层 npm 命令。
- 绿色版刷新只允许覆盖 portable exe 和对应 `version.txt`，完整打包需要用户明确要求。
- 历史进度不要继续塞进本文件；本文件只保留当前状态、下一步、风险和关键指针。

## Key Pointers

- Agent 入口地图：`AGENTS.md`
- 人类产品入口：`README.md`
- 历史状态账本：`docs/status/PROGRESS.md`
- 文档知识库索引：`docs/README.md`
- 绿色版 runbook：`docs/packaging/绿色版更新SOP.md`
- 优化记录 SOP：`docs/optimization/SOP.md`
- 旧专项 handoff：`docs/handoff/tauri-handoff.md`、`docs/handoff/word-portable-handoff.md`

## Refresh Rule

阶段结束、任务中断、方向切换、用户要求交接、或新风险出现时，刷新本文件。重大里程碑、失败复盘、方向废弃、重大交付才考虑另存 archive 快照。
