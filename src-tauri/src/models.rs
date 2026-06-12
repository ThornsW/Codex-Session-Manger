use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceReport {
    pub discovered_roots: Vec<String>,
    pub scanned_roots: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionStatus {
    Active,
    Archived,
    Orphaned,
    Abnormal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexSession {
    pub id: String,
    pub title: String,
    pub project_path: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub archived: bool,
    pub message_summary: String,
    pub session_file_paths: Vec<String>,
    pub index_records: Vec<String>,
    pub derived_cache_paths: Vec<String>,
    pub size_bytes: u64,
    pub status: SessionStatus,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub data_source_report: DataSourceReport,
    pub sessions: Vec<CodexSession>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeletionItemKind {
    SessionFile,
    IndexRecord,
    CacheFile,
    EmptyDirectory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeletionItem {
    pub kind: DeletionItemKind,
    pub path: Option<String>,
    pub description: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkippedDeletionItem {
    pub path: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeletionPlan {
    pub session_ids: Vec<String>,
    pub items: Vec<DeletionItem>,
    pub skipped: Vec<SkippedDeletionItem>,
    pub freed_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResult {
    pub deleted_session_ids: Vec<String>,
    pub deleted_items: Vec<DeletionItem>,
    pub skipped: Vec<SkippedDeletionItem>,
    pub freed_bytes: u64,
    pub audit_log_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexRoots {
    pub codex_home: PathBuf,
    pub app_data_roaming: Option<PathBuf>,
    pub app_data_local: Option<PathBuf>,
}
