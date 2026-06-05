# Markdown 文档审阅标注工作台

## Objective（目标）

构建一个本地桌面/浏览器工具，用于打开 Markdown 和 Word `.docx` 文档、直观审阅内容、对指定段落或文本块添加修改建议，并导出 Agent 可快速读取的结构化修改任务文件。

## Project Type（项目类型）

编程 / 内部工具

## Directory Structure（目录结构）

```text
Markdown文档审阅标注工作台/
- README.md            # 对外试用说明（用户视角：是什么、怎么用、限制、反馈）
- INSTRUCTIONS.md      # 项目章程（内部维护）
- PROGRESS.md          # 状态看板与变更记录
- SOP-绿色版更新.md    # 绿色版 exe 验收更新流程（铁律：不打包/不动版本号/不动 archive）
- src/                 # 源代码
  - app/               # React/Vite 前端应用
- docs/                # 产品设计、开发说明和使用说明
- output/              # 可交付成果、截图或导出样例
- assets/              # 项目素材与参考图
- archive/             # 废弃或旧版本文件
```

## AI Behavior Rules（AI 行为规则）

1. **文件纪律**：项目根目录仅保留 `README.md`、`INSTRUCTIONS.md`、`PROGRESS.md`、`SOP-绿色版更新.md` 四份维护文件，其余内容必须放进对应子目录（`src/` `docs/` `output/` `assets/` `archive/`）。
2. **工程位置**：前端应用文件统一放在 `src/app/`。
3. **进度追踪**：完成重要操作后更新 `PROGRESS.md`。
4. **归档而非删除**：被替代的重要文件移动到 `archive/` 并加日期前缀，避免直接删除。
5. **上下文恢复**：新会话继续该项目时，先读取 `INSTRUCTIONS.md` 和 `PROGRESS.md`。
6. **第一版范围优先**：优先保证单文件 Markdown 审阅、标注和导出闭环，不提前扩展在线 AI API。
7. **绿色版验收铁律**：功能/Bug 迭代的验收只刷绿色版 exe，铁律是 **只覆盖 `output/portable/.../Markdown文档审阅标注工作台.exe`、不打包 MSI/NSIS、不刷 portable zip、不改 `version` 字段、不动 `archive/`**。完整流程、PowerShell 命令、禁止动作和例外条件见同目录 `SOP-绿色版更新.md`，构建/验收前必读。

## Constraints（约束）

- 第一版不接入 AI API。
- 默认不污染原 Markdown / Word 文档，标注导出为旁边的 Agent 任务文件。
- UI 需要适合投标文件、技术方案、内部资料等严肃文档审阅场景。
- 优先使用本地浏览器能力读取文件；后续再扩展文件夹模式。
