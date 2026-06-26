# 开发与使用说明

## 日常使用

直接打开：

```text
output/markdown-review-workbench.html
```

这是单文件 HTML，双击即可使用，不需要启动服务。

## 重新生成单文件 HTML

在 `src/app/` 目录执行：

```powershell
npm install
npm run build:html
```

如果本机安装了 `make`，也可在仓库根目录执行：

```powershell
make build-html
```

生成结果：

```text
../../output/markdown-review-workbench.html
```

## 开发调试

在 `src/app/` 目录执行：

```powershell
npm install
npm run dev -- --port 5174
```

根目录快捷命令：

```powershell
make dev
```

访问：

```text
http://127.0.0.1:5174/
```

## 当前功能

- 打开单个 Markdown 文档。
- 可选打开文件夹，递归列出 3 层以内的 `.md` / `.markdown` 文件。
- 自动生成文档大纲。
- 将标题、段落、列表、引用、代码块、表格解析为可点击审阅块。
- 点击审阅块后在右侧填写修改建议。
- 修改建议输入后自动保存，不需要点击单条保存按钮。
- 输入框为空或被清空时不会覆盖已有标注。
- 支持动作、优先级、状态字段。
- 标注自动保存到浏览器本地存储。
- 支持导出 Agent 读取用 `*.ai-notes.json`。
- 支持导出人工复核用 `*.review.md`。

## Agent 使用方式

导出 `*.review.md` 或 `*.ai-notes.json` 后，可对 Agent 下达：

```text
请读取这个修改任务文件，按里面的标注定点修改原 Markdown 文档。
只修改标注对应位置，其他内容保持不变；涉及事实信息时回源核验。
```

## 已知边界

- 原 Markdown 文件不会被直接覆盖。
- 源码视图目前只读。
- 浏览器自动保存位置受浏览器安全策略限制，导出时需要用户选择保存位置。
- 单文件 HTML 通过浏览器本地文件能力读取 Markdown；如某浏览器限制高级文件夹读取，可使用“打开文档”单文件模式。
- Word、PDF、多人协作、在线 AI API 不属于 V0.1 范围。

## 验证记录

- `npm run build`：通过。
- `npm run build:html`：通过，已生成单文件 HTML。
- Playwright fallback：通过。
- 验证地址：`http://127.0.0.1:5174/`
- 单文件验证地址：`file:///.../output/markdown-review-workbench.html`
- 验证样例：`docs/product/product-blueprint.md`
- 截图位置：`output/playwright/`
