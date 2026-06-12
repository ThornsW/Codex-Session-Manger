use crate::errors::{io_error, AppResult};
use crate::jsonl::read_jsonl;
use crate::models::{CodexSession, DataSourceReport, ScanResult, SessionStatus};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
struct IndexRecord {
    title: String,
    updated_at: Option<String>,
    raw: String,
}

pub fn scan_codex_home(codex_home: &Path) -> AppResult<ScanResult> {
    let mut warnings = Vec::new();
    let index = read_index(codex_home, &mut warnings)?;
    let mut sessions = Vec::new();
    let sessions_dir = codex_home.join("sessions");
    let archived_dir = codex_home.join("archived_sessions");

    if sessions_dir.exists() {
        scan_session_tree(&sessions_dir, false, &index, &mut sessions, &mut warnings)?;
    } else {
        warnings.push(format!("Missing sessions directory: {}", sessions_dir.display()));
    }

    if archived_dir.exists() {
        scan_session_tree(&archived_dir, true, &index, &mut sessions, &mut warnings)?;
    }

    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(ScanResult {
        data_source_report: DataSourceReport {
            discovered_roots: vec![codex_home.display().to_string()],
            scanned_roots: vec![codex_home.display().to_string()],
            warnings,
        },
        sessions,
    })
}

fn read_index(codex_home: &Path, warnings: &mut Vec<String>) -> AppResult<HashMap<String, IndexRecord>> {
    let path = codex_home.join("session_index.jsonl");
    if !path.exists() {
        warnings.push(format!("Missing index file: {}", path.display()));
        return Ok(HashMap::new());
    }

    let mut records = HashMap::new();
    let content = fs::read_to_string(&path).map_err(|source| io_error(path.clone(), source))?;
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Value>(line) {
            Ok(value) => {
                if let Some(id) = value.get("id").and_then(Value::as_str) {
                    let title = value
                        .get("thread_name")
                        .and_then(Value::as_str)
                        .unwrap_or("未命名")
                        .to_string();
                    let updated_at = value
                        .get("updated_at")
                        .and_then(Value::as_str)
                        .map(str::to_string);
                    records.insert(
                        id.to_string(),
                        IndexRecord {
                            title,
                            updated_at,
                            raw: line.to_string(),
                        },
                    );
                }
            }
            Err(err) => warnings.push(format!("Invalid index row in {}: {}", path.display(), err)),
        }
    }
    Ok(records)
}

fn scan_session_tree(
    root: &Path,
    archived: bool,
    index: &HashMap<String, IndexRecord>,
    sessions: &mut Vec<CodexSession>,
    warnings: &mut Vec<String>,
) -> AppResult<()> {
    for entry in WalkDir::new(root) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                warnings.push(format!("Traversal error under {}: {}", root.display(), err));
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.path().extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }
        match parse_session_file(entry.path(), archived, index) {
            Ok(session) => sessions.push(session),
            Err(err) => warnings.push(format!("Skipped {}: {}", entry.path().display(), err)),
        }
    }
    Ok(())
}

fn parse_session_file(
    path: &Path,
    archived: bool,
    index: &HashMap<String, IndexRecord>,
) -> AppResult<CodexSession> {
    let rows = read_jsonl(path)?;
    let size_bytes = fs::metadata(path)
        .map_err(|source| io_error(path.to_path_buf(), source))?
        .len();
    let mut id = session_id_from_filename(path).unwrap_or_else(|| "unknown".to_string());
    let mut created_at = None;
    let mut updated_at = None;
    let mut project_path = None;
    let mut message_summary = String::new();

    for row in rows {
        let timestamp = row.get("timestamp").and_then(Value::as_str).map(str::to_string);
        if created_at.is_none() {
            created_at = timestamp.clone();
        }
        if timestamp.is_some() {
            updated_at = timestamp;
        }

        if row.get("type").and_then(Value::as_str) == Some("session_meta") {
            if let Some(payload) = row.get("payload") {
                if let Some(meta_id) = payload.get("id").and_then(Value::as_str) {
                    id = meta_id.to_string();
                }
                if project_path.is_none() {
                    project_path = payload.get("cwd").and_then(Value::as_str).map(str::to_string);
                }
            }
        }

        if message_summary.is_empty() {
            if let Some(text) = extract_message_text(row.get("payload")) {
                message_summary = trim_summary(&text);
            }
        }
    }

    let record = index.get(&id);
    let title = record
        .map(|record| record.title.clone())
        .filter(|title| !title.trim().is_empty())
        .unwrap_or_else(|| "未命名会话".to_string());

    if let Some(index_updated_at) = record.and_then(|record| record.updated_at.clone()) {
        updated_at = Some(index_updated_at);
    }

    Ok(CodexSession {
        id,
        title,
        project_path,
        created_at,
        updated_at,
        archived,
        message_summary,
        session_file_paths: vec![path.display().to_string()],
        index_records: record.map(|record| vec![record.raw.clone()]).unwrap_or_default(),
        derived_cache_paths: vec![],
        size_bytes,
        status: if archived {
            SessionStatus::Archived
        } else {
            SessionStatus::Active
        },
        warnings: vec![],
    })
}

fn session_id_from_filename(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    let tail = stem.strip_prefix("rollout-")?;
    let parts: Vec<&str> = tail.split('-').collect();
    if parts.len() < 10 {
        return None;
    }
    Some(parts[5..10].join("-"))
}

fn extract_message_text(payload: Option<&Value>) -> Option<String> {
    let payload = payload?;
    if payload.get("type").and_then(Value::as_str) != Some("message") {
        return None;
    }
    let content = payload.get("content")?.as_array()?;
    for item in content {
        if let Some(text) = item.get("text").and_then(Value::as_str) {
            if !text.trim().is_empty() {
                return Some(text.to_string());
            }
        }
    }
    None
}

fn trim_summary(input: &str) -> String {
    let normalized = input.split_whitespace().collect::<Vec<_>>().join(" ");
    normalized.chars().take(160).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn scans_fixture_sessions_and_groups_by_project_path() {
        let root = fixture_root();

        let result = scan_codex_home(&root).unwrap();

        assert_eq!(result.sessions.len(), 2);
        assert_eq!(result.sessions[0].id, "22222222-2222-4222-8222-222222222222");
        assert!(result
            .sessions
            .iter()
            .any(|session| session.project_path.as_deref() == Some("D:\\Library\\FixtureProject")));
        assert!(result
            .sessions
            .iter()
            .any(|session| session.title == "Fixture cleanup work"));
    }

    #[test]
    fn extracts_summary_from_first_message() {
        let root = fixture_root();

        let result = scan_codex_home(&root).unwrap();
        let session = result
            .sessions
            .iter()
            .find(|session| session.id == "11111111-1111-4111-8111-111111111111")
            .unwrap();

        assert_eq!(session.message_summary, "Clean this Codex project history.");
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../fixtures/codex-home")
    }
}
