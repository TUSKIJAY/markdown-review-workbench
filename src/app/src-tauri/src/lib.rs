use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadedDocument {
    file_name: String,
    file_path: String,
    markdown: String,
    content_hash: String,
    total_lines: usize,
    source_format: String,
    conversion_messages: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderDocumentFile {
    name: String,
    path: String,
    source_format: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedFolder {
    folder_path: String,
    files: Vec<FolderDocumentFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadedBinaryDocument {
    file_name: String,
    file_path: String,
    source_format: String,
    bytes_base64: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadedSourceDocument {
    file_name: String,
    file_path: String,
    source_format: String,
    markdown: Option<String>,
    content_hash: Option<String>,
    total_lines: Option<usize>,
    bytes_base64: Option<String>,
    conversion_messages: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteReviewFilesResult {
    ai_notes_path: String,
    review_path: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExistingReviewFiles {
    ai_notes: Option<String>,
    review: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkdownImageAsset {
    data_url: String,
}

fn normalize_line_endings(markdown: &str) -> String {
    markdown.replace("\r\n", "\n").replace('\r', "\n")
}

fn create_content_hash(source: &str) -> String {
    let mut hash: u32 = 5381;
    for unit in source.encode_utf16() {
        hash = hash.wrapping_mul(33) ^ u32::from(unit);
    }
    format!("{hash:08x}")
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown"))
        .unwrap_or(false)
}

fn source_format_from_path(path: &Path) -> Option<&'static str> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .and_then(|extension| match extension.to_ascii_lowercase().as_str() {
            "md" | "markdown" => Some("markdown"),
            "docx" => Some("docx"),
            _ => None,
        })
}

fn image_mime_from_path(path: &Path) -> Option<&'static str> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .and_then(|extension| match extension.to_ascii_lowercase().as_str() {
            "png" => Some("image/png"),
            "jpg" | "jpeg" => Some("image/jpeg"),
            "gif" => Some("image/gif"),
            "webp" => Some("image/webp"),
            "svg" => Some("image/svg+xml"),
            "bmp" => Some("image/bmp"),
            _ => None,
        })
}

fn is_reviewable_path(path: &Path) -> bool {
    source_format_from_path(path).is_some()
}

fn read_document_from_path(path: &Path) -> Result<LoadedDocument, String> {
    if !path.is_file() {
        return Err("路径不是文件".to_string());
    }

    if !is_markdown_path(path) {
        return Err("请选择 .md 或 .markdown 文件".to_string());
    }

    let markdown = fs::read_to_string(path).map_err(|error| format!("读取 Markdown 失败: {error}"))?;
    let normalized = normalize_line_endings(&markdown);
    let content_hash = create_content_hash(&markdown);
    let total_lines = normalized.split('\n').count();
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法读取文件名".to_string())?
        .to_string();

    Ok(LoadedDocument {
        file_name,
        file_path: path_to_string(path),
        markdown,
        content_hash,
        total_lines,
        source_format: "markdown".to_string(),
        conversion_messages: Vec::new(),
    })
}

fn read_binary_document_from_path(path: &Path) -> Result<LoadedBinaryDocument, String> {
    if !path.is_file() {
        return Err("路径不是文件".to_string());
    }

    let source_format = source_format_from_path(path).ok_or_else(|| "请选择 .md、.markdown 或 .docx 文件".to_string())?;
    if source_format != "docx" {
        return Err("当前文件不是 Word DOCX".to_string());
    }

    let bytes = fs::read(path).map_err(|error| format!("读取 Word 文件失败: {error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法读取文件名".to_string())?
        .to_string();

    Ok(LoadedBinaryDocument {
        file_name,
        file_path: path_to_string(path),
        source_format: source_format.to_string(),
        bytes_base64: general_purpose::STANDARD.encode(bytes),
    })
}

fn read_source_document_from_path(path: &Path) -> Result<LoadedSourceDocument, String> {
    match source_format_from_path(path) {
        Some("markdown") => {
            let document = read_document_from_path(path)?;
            Ok(LoadedSourceDocument {
                file_name: document.file_name,
                file_path: document.file_path,
                source_format: document.source_format,
                markdown: Some(document.markdown),
                content_hash: Some(document.content_hash),
                total_lines: Some(document.total_lines),
                bytes_base64: None,
                conversion_messages: Vec::new(),
            })
        }
        Some("docx") => {
            let document = read_binary_document_from_path(path)?;
            Ok(LoadedSourceDocument {
                file_name: document.file_name,
                file_path: document.file_path,
                source_format: document.source_format,
                markdown: None,
                content_hash: None,
                total_lines: None,
                bytes_base64: Some(document.bytes_base64),
                conversion_messages: Vec::new(),
            })
        }
        _ => Err("请选择 .md、.markdown 或 .docx 文件".to_string()),
    }
}

fn collect_document_files(folder: &Path, depth: usize, files: &mut Vec<FolderDocumentFile>) -> Result<(), String> {
    if depth > 3 {
        return Ok(());
    }

    let entries = fs::read_dir(folder).map_err(|error| format!("读取文件夹失败: {error}"))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("读取文件夹条目失败: {error}"))?;
        let path = entry.path();

        if path.is_dir() {
            collect_document_files(&path, depth + 1, files)?;
        } else if is_reviewable_path(&path) {
            let name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("未命名文档")
                .to_string();
            let source_format = source_format_from_path(&path).unwrap_or("markdown").to_string();
            files.push(FolderDocumentFile {
                name,
                path: path_to_string(&path),
                source_format,
            });
        }
    }

    Ok(())
}

#[tauri::command]
async fn open_document_file(app: tauri::AppHandle) -> Result<LoadedSourceDocument, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("文档", &["md", "markdown", "docx"])
        .add_filter("Markdown", &["md", "markdown"])
        .add_filter("Word", &["docx"])
        .blocking_pick_file()
        .ok_or_else(|| "cancelled".to_string())?
        .into_path()
        .map_err(|error| format!("无法解析文件路径: {error}"))?;

    read_source_document_from_path(&file_path)
}

#[tauri::command]
async fn read_document_file(path: String) -> Result<LoadedSourceDocument, String> {
    read_source_document_from_path(Path::new(&path))
}

#[tauri::command]
async fn open_markdown_folder(app: tauri::AppHandle) -> Result<OpenedFolder, String> {
    let folder_path = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or_else(|| "cancelled".to_string())?
        .into_path()
        .map_err(|error| format!("无法解析文件夹路径: {error}"))?;

    let mut files = Vec::new();
    collect_document_files(&folder_path, 0, &mut files)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(OpenedFolder {
        folder_path: path_to_string(&folder_path),
        files,
    })
}

#[tauri::command]
async fn write_review_files(
    source_path: String,
    ai_notes_json: String,
    review_markdown: String,
) -> Result<WriteReviewFilesResult, String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("源文件不存在".to_string());
    }

    let parent = source.parent().ok_or_else(|| "无法定位源文件所在目录".to_string())?;
    let stem = source
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "无法读取源文件名".to_string())?;

    let ai_notes_path = parent.join(format!("{stem}.ai-notes.json"));
    let review_path = parent.join(format!("{stem}.review.md"));

    fs::write(&ai_notes_path, ai_notes_json).map_err(|error| format!("写入 ai-notes 失败: {error}"))?;
    fs::write(&review_path, review_markdown).map_err(|error| format!("写入 review 失败: {error}"))?;

    let updated_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| format!("unix:{}", duration.as_secs()))
        .unwrap_or_else(|_| "unix:0".to_string());

    Ok(WriteReviewFilesResult {
        ai_notes_path: path_to_string(&ai_notes_path),
        review_path: path_to_string(&review_path),
        updated_at,
    })
}

// 读取源文件同目录已存在的 sidecar 内容，供前端在自动同步前比对是否被外部改动。
// 文件不存在时对应字段返回 None，不视为错误。
#[tauri::command]
async fn read_review_files(source_path: String) -> Result<ExistingReviewFiles, String> {
    let source = PathBuf::from(source_path);
    let parent = source
        .parent()
        .ok_or_else(|| "无法定位源文件所在目录".to_string())?;
    let stem = source
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "无法读取源文件名".to_string())?;

    let ai_notes_path = parent.join(format!("{stem}.ai-notes.json"));
    let review_path = parent.join(format!("{stem}.review.md"));

    Ok(ExistingReviewFiles {
        ai_notes: fs::read_to_string(&ai_notes_path).ok(),
        review: fs::read_to_string(&review_path).ok(),
    })
}

// 读取 Markdown 中的相对图片引用。仅允许访问源 Markdown 所在目录及子目录下的图片，
// 避免预览图片功能变成任意本地文件读取。
#[tauri::command]
async fn read_markdown_image(source_path: String, image_path: String) -> Result<MarkdownImageAsset, String> {
    if image_path.contains("://") || image_path.starts_with('/') || image_path.starts_with('\\') {
        return Err("仅支持相对图片路径".to_string());
    }

    let source = PathBuf::from(source_path);
    if !source.is_file() || !is_markdown_path(&source) {
        return Err("源 Markdown 文件不存在".to_string());
    }

    let parent = source
        .parent()
        .ok_or_else(|| "无法定位源文件所在目录".to_string())?;
    let parent = parent
        .canonicalize()
        .map_err(|error| format!("无法解析源文件目录: {error}"))?;
    let candidate = parent.join(image_path);
    let candidate = candidate
        .canonicalize()
        .map_err(|error| format!("图片不存在或无法读取: {error}"))?;

    if !candidate.starts_with(&parent) {
        return Err("图片路径超出源文档目录".to_string());
    }

    let mime = image_mime_from_path(&candidate).ok_or_else(|| "不支持的图片格式".to_string())?;
    let bytes = fs::read(&candidate).map_err(|error| format!("读取图片失败: {error}"))?;
    Ok(MarkdownImageAsset {
        data_url: format!("data:{mime};base64,{}", general_purpose::STANDARD.encode(bytes)),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_document_file,
            read_document_file,
            open_markdown_folder,
            read_review_files,
            read_markdown_image,
            write_review_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
