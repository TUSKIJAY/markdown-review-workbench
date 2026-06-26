# docs/ 目录规约与索引

> 本文件是 `docs/` 下文档归类、命名和查找的入口。
> 一句话方针：正式文档按用途归入子目录，`docs/` 根目录只放本索引。

## 总原则

- `docs/` 根目录只放 `README.md`，不要堆零散文档。
- 新文档优先归入下面的既有目录；拿不准时先放 `notes/`，并标注“待归类”。
- 有实施计划、验收证据或交接说明时，文档与相关截图/数据就近存放。
- 文档调整尽量只移动或补索引，不混入源码改动。
- 当前接手入口只维护 `handoff/session-handoff.md` 这一份最新版。
- 历史状态只维护 `status/PROGRESS.md` 这一份长期 log 库，开头必须有索引。

## 子目录归属表

| 目录 | 装什么 | 不装什么 | 命名约定 |
|---|---|---|---|
| `product/` | 产品定位、功能范围、路线图、原型说明 | 开发命令、打包流程、临时笔记 | `<主题>-blueprint.md` 或 `<主题>-spec.md` |
| `development/` | 本地开发、构建、使用说明、技术运行手册 | 具体阶段交接、验收报告 | `<主题>-and-usage.md` 或 `<主题>-guide.md` |
| `packaging/` | 绿色版 exe、安装包、分发产物相关 SOP | 普通开发记录、产品说明 | `<主题>SOP.md` 或 `<主题>-runbook.md` |
| `status/` | 历史状态账本、进度 log、索引化状态库 | 当前接手入口、执行 SOP | `PROGRESS.md` |
| `handoff/` | 当前 session 接手 index、专项交接材料 | 历史流水账、长期产品蓝图 | `session-handoff.md` 或 `<主题>-handoff.md` |
| `acceptance/` | 交付验收报告、截图证据、验收记录 | 开发中零散进展、代码改动说明 | `YYYY-MM-DD-<场景>/验收报告.md` |
| `optimization/` | 优化点收集、按日期批次管理的改进清单、优化验收记录 | 已确认要立即实施的源码改动 | 见 `optimization/SOP.md` |
| `notes/` | 随手笔记、未归类暂存、探索记录 | 已成形的正式交付物 | `<主题>.md` |

## 当前索引

### product/

- [`product/product-blueprint.md`](product/product-blueprint.md)：产品定位、V0.1 范围、非目标和典型流程。

### development/

- [`development/development-and-usage.md`](development/development-and-usage.md)：单文件 HTML、本地开发、构建命令、当前功能与验证记录。
- [`development/project-rules.md`](development/project-rules.md)：项目维护边界，承接原根目录 `INSTRUCTIONS.md`。

### packaging/

- [`packaging/绿色版更新SOP.md`](packaging/绿色版更新SOP.md)：绿色版 exe 刷新与验收流程。

### status/

- [`status/PROGRESS.md`](status/PROGRESS.md)：唯一历史 log 库 / 状态账本，开头维护状态索引。

### handoff/

- [`handoff/session-handoff.md`](handoff/session-handoff.md)：当前接手 index，只维护最新状态、下一步、风险和关键指针。
- [`handoff/tauri-handoff.md`](handoff/tauri-handoff.md)：从 React/Vite 单文件 HTML 迁移到 Tauri 桌面版的交接说明。
- [`handoff/word-portable-handoff.md`](handoff/word-portable-handoff.md)：Word 兼容、绿色版验证与旧安装版排查交接。

### acceptance/

- 暂无。后续按 `YYYY-MM-DD-<场景>/验收报告.md` 建目录，截图放同级 `screenshots/`。

### optimization/

- [`optimization/SOP.md`](optimization/SOP.md)：优化点记录流程，强调收集阶段只记录、不改代码。
- [`optimization/template-优化清单.md`](optimization/template-优化清单.md)：优化批次总索引。

### notes/

- 暂无。临时想法或待归类材料先放这里，成形后迁入正式目录。

## 新增文档自检

1. 这份文档属于哪个子目录？
2. 文件名能否一眼看出主题和用途？
3. 是否需要同步更新本 README 的“当前索引”？
4. 如果有截图或数据，是否已经放在同一主题目录下？
5. 是否需要更新 `handoff/session-handoff.md` 的当前接手信息？
6. 是否需要在 `status/PROGRESS.md` 追加历史 log 或更新开头索引？
