# SOP — 绿色版更新与验收

适用范围：本工具的所有功能/排版/Bug 修复迭代，验收阶段统一走绿色版 exe。

## 铁律

1. **只更新绿色版 exe**：每次改动验收，只覆盖
   `output/portable/Markdown文档审阅标注工作台/Markdown文档审阅标注工作台.exe`，
   不动其它分发产物。
2. **不自动打包**：禁止生成或刷新 MSI / NSIS 安装包，禁止重新打 portable zip。
   旧的 `Markdown文档审阅标注工作台-portable.zip` 留在原地不动。
3. **不修改安装版本号**：`src/app/src-tauri/tauri.conf.json`、`Cargo.toml`、
   `src/app/package.json` 里的 `version` 字段一律保持不变。
4. **不动 archive / 旧 installer**：`archive/` 下的旧版本 exe / msi / 安装记录不覆盖、不删除。
5. **构建前先关进程**：覆盖 exe 前若有 `Markdown文档审阅标注工作台.exe`
   或 `markdown-review-workbench.exe` 在运行，先 Stop-Process，避免文件占用失败。

## 标准更新流程

执行人：当前会话的 AI agent。

```powershell
$project = "C:\Users\LENOVO\Desktop\工作\星际之门\林境售前workspace\项目\内部工具\Markdown文档审阅标注工作台"
$src = Join-Path $project "src\app\src-tauri\target\release\markdown-review-workbench.exe"
$portable = Join-Path $project "output\portable\Markdown文档审阅标注工作台"
$dst = Join-Path $portable "Markdown文档审阅标注工作台.exe"

# 1. 关闭可能在跑的旧进程
Get-Process -Name "Markdown文档审阅标注工作台","markdown-review-workbench" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. 准备 Rust 工具链路径
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# 3. 编译 release（带 --no-bundle，跳过 MSI/NSIS 打包）
Set-Location (Join-Path $project "src\app")
npm run tauri:build -- --no-bundle

# 4. 覆盖绿色版 exe
Copy-Item -LiteralPath $src -Destination $dst -Force

# 5. 刷新绿色版 version.txt（只更新这一份，不动其它）
$build = (Get-Item $src).LastWriteTime.ToString("yyyy-MM-dd HH:mm")
"Markdown 文档审阅标注工作台 (绿色版)`r`n构建时间: $build`r`n本次变更要点: <用一句话描述本次改动>" |
    Out-File -FilePath (Join-Path $portable "version.txt") -Encoding utf8 -NoNewline

# 6. 告知用户：用 $dst 这个 exe 验收，不要去运行安装版
```

## 禁止动作

- `npm run tauri:build`（不带 `--no-bundle`）— 会触发 MSI/NSIS 打包。
- `Compress-Archive ... -DestinationPath ...portable.zip`
- 修改 `tauri.conf.json` 的 `version`
- 修改 `Cargo.toml` 的 `[package].version`
- 修改 `package.json` 的 `version`
- 覆盖、移动或删除 `archive/` 下的任何文件
- 重命名 / 移动 `output/portable/Markdown文档审阅标注工作台-portable.zip`
- 把新构建拷贝到 `output/desktop/` 或安装目录

## 验收交付物

每次更新后只需要告诉用户：

```text
exe: <项目>/output/portable/Markdown文档审阅标注工作台/Markdown文档审阅标注工作台.exe
构建时间: YYYY-MM-DD HH:mm
本次变更: <一句话>
```

用户双击这个 exe 验收。验收通过后再决定是否走完整打包流程（届时用户会主动要求）。

## 例外

只有在用户明确说"发版"、"打安装包"、"刷新 zip"、"更新 archive"时，
才允许执行 MSI/NSIS 打包、压 zip、归档等动作。除此之外按本 SOP 执行。
