use crate::errors::{io_error, AppResult};
use crate::models::DeleteResult;
use crate::paths::{ensure_existing_or_parent_inside_roots, ensure_inside_roots};
use serde_json::json;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use time::OffsetDateTime;

pub fn validate_audit_log_path(codex_home: &Path, known_roots: &[PathBuf]) -> AppResult<PathBuf> {
    let safe_codex_home = ensure_inside_roots(codex_home, known_roots)?;
    let log_dir = safe_codex_home.join("codex-session-manager");
    let log_dir = ensure_existing_or_parent_inside_roots(&log_dir, known_roots)?;
    let log_path = log_dir.join("audit.jsonl");
    if log_dir.exists() {
        ensure_existing_or_parent_inside_roots(&log_path, known_roots)
    } else {
        Ok(log_path)
    }
}

pub fn append_audit_log(
    codex_home: &Path,
    known_roots: &[PathBuf],
    result: &DeleteResult,
) -> AppResult<PathBuf> {
    let safe_codex_home = ensure_inside_roots(codex_home, known_roots)?;
    let log_dir = safe_codex_home.join("codex-session-manager");
    let log_dir = ensure_existing_or_parent_inside_roots(&log_dir, known_roots)?;
    fs::create_dir_all(&log_dir).map_err(|source| io_error(log_dir.clone(), source))?;
    let log_path = log_dir.join("audit.jsonl");
    let log_path = ensure_existing_or_parent_inside_roots(&log_path, known_roots)?;
    let timestamp = OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown".to_string());
    let row = json!({
        "timestamp": timestamp,
        "deletedSessionIds": &result.deleted_session_ids,
        "deletedItems": &result.deleted_items,
        "skipped": &result.skipped,
        "freedBytes": result.freed_bytes,
    });
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|source| io_error(log_path.clone(), source))?;
    writeln!(file, "{row}").map_err(|source| io_error(log_path.clone(), source))?;
    Ok(log_path)
}
