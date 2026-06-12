use crate::audit::{append_audit_log, validate_audit_log_path};
use crate::errors::{io_error, AppError, AppResult};
use crate::models::{
    CodexSession, DeleteResult, DeletionItem, DeletionItemKind, DeletionPlan, SkippedDeletionItem,
};
use crate::paths::{ensure_existing_or_parent_inside_roots, ensure_inside_roots, is_empty_directory};
use crate::scanner::scan_codex_home;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

pub fn build_deletion_plan(
    codex_home: &Path,
    known_roots: &[PathBuf],
    session_ids: &[String],
) -> AppResult<DeletionPlan> {
    let safe_codex_home = ensure_inside_roots(codex_home, known_roots)?;
    let scan = scan_codex_home(&safe_codex_home)?;
    let index_path = safe_codex_home.join("session_index.jsonl");
    let mut items = Vec::new();
    let mut skipped = Vec::new();
    let mut freed_bytes = 0;

    for session_id in session_ids {
        let Some(session) = scan.sessions.iter().find(|session| &session.id == session_id) else {
            skipped.push(SkippedDeletionItem {
                path: None,
                reason: format!("Session not found: {session_id}"),
            });
            continue;
        };
        add_session_file_items(session, known_roots, &mut items, &mut skipped, &mut freed_bytes);
        add_index_items(session, &index_path, &mut items, &mut freed_bytes);
    }

    Ok(DeletionPlan {
        session_ids: session_ids.to_vec(),
        items,
        skipped,
        freed_bytes,
    })
}

fn add_session_file_items(
    session: &CodexSession,
    known_roots: &[PathBuf],
    items: &mut Vec<DeletionItem>,
    skipped: &mut Vec<SkippedDeletionItem>,
    freed_bytes: &mut u64,
) {
    for path in &session.session_file_paths {
        let path_buf = PathBuf::from(path);
        match ensure_inside_roots(&path_buf, known_roots) {
            Ok(safe_path) => {
                let size = fs::metadata(&safe_path)
                    .map(|metadata| metadata.len())
                    .unwrap_or(0);
                *freed_bytes += size;
                items.push(DeletionItem {
                    kind: DeletionItemKind::SessionFile,
                    path: Some(safe_path.display().to_string()),
                    description: format!("Delete session file for {}", session.id),
                    size_bytes: size,
                    session_id: Some(session.id.clone()),
                    evidence: None,
                });
            }
            Err(err) => skipped.push(SkippedDeletionItem {
                path: Some(path.clone()),
                reason: err.to_string(),
            }),
        }
    }
}

fn add_index_items(
    session: &CodexSession,
    index_path: &Path,
    items: &mut Vec<DeletionItem>,
    freed_bytes: &mut u64,
) {
    for record in &session.index_records {
        let size = record.len() as u64;
        *freed_bytes += size;
        items.push(DeletionItem {
            kind: DeletionItemKind::IndexRecord,
            path: Some(index_path.display().to_string()),
            description: format!("Remove session_index.jsonl row for {}", session.id),
            size_bytes: size,
            session_id: Some(session.id.clone()),
            evidence: Some(record.clone()),
        });
    }
}

pub fn assert_plan_targets_inside_roots(plan: &DeletionPlan, known_roots: &[PathBuf]) -> AppResult<()> {
    for item in &plan.items {
        if let Some(path) = &item.path {
            match item.kind {
                DeletionItemKind::IndexRecord => {
                    ensure_existing_or_parent_inside_roots(Path::new(path), known_roots)?;
                }
                _ => {
                    ensure_inside_roots(Path::new(path), known_roots)?;
                }
            }
        }
    }
    Ok(())
}

pub fn execute_deletion_plan(
    codex_home: &Path,
    known_roots: &[PathBuf],
    plan: DeletionPlan,
) -> AppResult<DeleteResult> {
    let safe_codex_home = ensure_inside_roots(codex_home, known_roots)?;
    assert_plan_targets_inside_roots(&plan, known_roots)?;
    validate_index_rewrite_paths(&safe_codex_home, known_roots)?;
    validate_audit_log_path(&safe_codex_home, known_roots)?;
    let mut deleted_items = Vec::new();
    let mut skipped = plan.skipped.clone();

    for item in &plan.items {
        match item.kind {
            DeletionItemKind::SessionFile | DeletionItemKind::CacheFile => {
                if let Some(path) = &item.path {
                    match fs::remove_file(Path::new(path)) {
                        Ok(()) => deleted_items.push(item.clone()),
                        Err(source) => skipped.push(SkippedDeletionItem {
                            path: Some(path.clone()),
                            reason: source.to_string(),
                        }),
                    }
                }
            }
            DeletionItemKind::EmptyDirectory => {
                if let Some(path) = &item.path {
                    let dir = PathBuf::from(path);
                    if is_empty_directory(&dir).unwrap_or(false) {
                        match fs::remove_dir(&dir) {
                            Ok(()) => deleted_items.push(item.clone()),
                            Err(source) => skipped.push(SkippedDeletionItem {
                                path: Some(path.clone()),
                                reason: source.to_string(),
                            }),
                        }
                    }
                }
            }
            DeletionItemKind::IndexRecord => {}
        }
    }

    let planned_index_records = planned_index_records(&plan);
    let removed_index_records = rewrite_index_without_sessions(
        &safe_codex_home,
        known_roots,
        &plan.session_ids,
        &planned_index_records,
        &mut skipped,
    )?;
    let removed_index_records = removed_index_records.into_iter().collect::<HashSet<_>>();
    for item in plan
        .items
        .iter()
        .filter(|item| item.kind == DeletionItemKind::IndexRecord)
    {
        let Some(record) = index_record_from_item(item) else {
            skipped.push(SkippedDeletionItem {
                path: item.path.clone(),
                reason: "Unable to identify planned index row".to_string(),
            });
            continue;
        };

        if removed_index_records.contains(&record) {
            deleted_items.push(item.clone());
        }
    }

    let freed_bytes = deleted_items.iter().map(|item| item.size_bytes).sum();
    let deleted_session_ids = deleted_session_ids_from_items(&deleted_items);
    let mut result = DeleteResult {
        deleted_session_ids,
        deleted_items,
        skipped,
        freed_bytes,
        audit_log_path: String::new(),
    };
    let audit_path = append_audit_log(&safe_codex_home, known_roots, &result)?;
    result.audit_log_path = audit_path.display().to_string();
    Ok(result)
}

fn rewrite_index_without_sessions(
    codex_home: &Path,
    known_roots: &[PathBuf],
    session_ids: &[String],
    planned_records: &[String],
    skipped: &mut Vec<SkippedDeletionItem>,
) -> AppResult<Vec<String>> {
    let safe_codex_home = ensure_inside_roots(codex_home, known_roots)?;
    let index_path = safe_codex_home.join("session_index.jsonl");
    let index_path = ensure_existing_or_parent_inside_roots(&index_path, known_roots)?;
    if !index_path.exists() {
        skipped.push(SkippedDeletionItem {
            path: Some(index_path.display().to_string()),
            reason: "Index file not found; no rows removed".to_string(),
        });
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&index_path).map_err(|source| io_error(index_path.clone(), source))?;
    let selected_session_ids = session_ids.iter().cloned().collect::<HashSet<_>>();
    let mut planned_by_id: HashMap<String, HashSet<String>> = HashMap::new();
    for record in planned_records {
        if let Some(id) = index_record_id(record) {
            if selected_session_ids.contains(&id) {
                planned_by_id.entry(id).or_default().insert(record.clone());
            }
        }
    }

    let mut kept = Vec::new();
    let mut removed = Vec::new();
    let mut changed_session_ids = HashSet::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let row_id = index_record_id(line);
        let should_remove = row_id
            .as_ref()
            .and_then(|id| planned_by_id.get(id))
            .is_some_and(|planned| planned.contains(line));

        if should_remove {
            removed.push(line.to_string());
            continue;
        }

        if let Some(id) = row_id {
            if planned_by_id.contains_key(&id) && changed_session_ids.insert(id.clone()) {
                skipped.push(SkippedDeletionItem {
                    path: Some(index_path.display().to_string()),
                    reason: format!("Index row changed since preview for session: {id}"),
                });
            }
        }
        kept.push(line);
    }

    let removed_records = removed.iter().cloned().collect::<HashSet<_>>();
    for record in planned_records {
        if !removed_records.contains(record) {
            let session = index_record_id(record)
                .map(|id| format!(" for session: {id}"))
                .unwrap_or_default();
            skipped.push(SkippedDeletionItem {
                path: Some(index_path.display().to_string()),
                reason: format!("Planned index row not found during rewrite{session}"),
            });
        }
    }

    if removed.is_empty() {
        return Ok(removed);
    }

    let temp_path = index_path.with_extension("jsonl.tmp");
    let temp_path = ensure_existing_or_parent_inside_roots(&temp_path, known_roots)?;
    fs::write(
        &temp_path,
        if kept.is_empty() {
            String::new()
        } else {
            format!("{}\n", kept.join("\n"))
        },
    )
    .map_err(|source| io_error(temp_path.clone(), source))?;
    replace_file_contents(&temp_path, &index_path).map_err(|source| {
        skipped.push(SkippedDeletionItem {
            path: Some(index_path.display().to_string()),
            reason: source.to_string(),
        });
        source
    })?;
    Ok(removed)
}

fn replace_file_contents(temp_path: &Path, target_path: &Path) -> AppResult<()> {
    fs::copy(temp_path, target_path).map_err(|source| io_error(target_path.to_path_buf(), source))?;
    fs::remove_file(temp_path).map_err(|source| io_error(temp_path.to_path_buf(), source))?;
    Ok(())
}

fn validate_index_rewrite_paths(codex_home: &Path, known_roots: &[PathBuf]) -> AppResult<()> {
    let safe_codex_home = ensure_inside_roots(codex_home, known_roots)?;
    let index_path = safe_codex_home.join("session_index.jsonl");
    let index_path = ensure_existing_or_parent_inside_roots(&index_path, known_roots)?;
    if index_path.exists() {
        let temp_path = index_path.with_extension("jsonl.tmp");
        ensure_existing_or_parent_inside_roots(&temp_path, known_roots)?;
    }
    Ok(())
}

fn index_record_from_item(item: &DeletionItem) -> Option<String> {
    item.evidence.clone()
}

fn planned_index_records(plan: &DeletionPlan) -> Vec<String> {
    plan.items
        .iter()
        .filter(|item| item.kind == DeletionItemKind::IndexRecord)
        .filter_map(index_record_from_item)
        .collect()
}

fn index_record_id(record: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(record)
        .ok()
        .and_then(|value| value.get("id").and_then(|id| id.as_str()).map(str::to_string))
}

fn deleted_session_ids_from_items(items: &[DeletionItem]) -> Vec<String> {
    let mut ids = items
        .iter()
        .filter_map(|item| item.session_id.clone())
        .collect::<Vec<_>>();
    ids.sort();
    ids.dedup();
    ids
}

pub fn plan_session_ids(plan: &DeletionPlan) -> Vec<String> {
    plan.session_ids.clone()
}

pub fn path_outside_root_error(path: PathBuf) -> AppError {
    AppError::PathOutsideRoot(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::prelude::*;

    #[test]
    fn builds_plan_for_fixture_session() {
        let root = fixture_root();

        let plan = build_deletion_plan(
            &root,
            &[root.clone()],
            &["11111111-1111-4111-8111-111111111111".to_string()],
        )
        .unwrap();

        assert_eq!(plan.session_ids, vec!["11111111-1111-4111-8111-111111111111"]);
        assert!(plan
            .items
            .iter()
            .any(|item| item.kind == DeletionItemKind::SessionFile));
        assert!(plan
            .items
            .iter()
            .any(|item| item.kind == DeletionItemKind::IndexRecord));
        assert!(plan.freed_bytes > 0);
    }

    #[test]
    fn reports_missing_session_as_skipped() {
        let root = fixture_root();

        let plan = build_deletion_plan(&root, &[root.clone()], &["missing".to_string()]).unwrap();

        assert_eq!(plan.items.len(), 0);
        assert_eq!(plan.skipped[0].reason, "Session not found: missing");
    }

    #[test]
    fn executes_deletion_inside_temp_fixture_copy() {
        let temp = assert_fs::TempDir::new().unwrap();
        temp.copy_from(fixture_root(), &["**/*"]).unwrap();
        let root = temp.path().to_path_buf();
        let session_id = "11111111-1111-4111-8111-111111111111".to_string();
        let plan = build_deletion_plan(&root, &[root.clone()], &[session_id.clone()]).unwrap();

        let result = execute_deletion_plan(&root, &[root.clone()], plan).unwrap();

        assert_eq!(result.deleted_session_ids, vec![session_id]);
        assert!(result
            .deleted_items
            .iter()
            .any(|item| item.kind == DeletionItemKind::SessionFile));
        let index = std::fs::read_to_string(root.join("session_index.jsonl")).unwrap();
        assert!(!index.contains("11111111-1111-4111-8111-111111111111"));
        assert!(std::path::Path::new(&result.audit_log_path).exists());
        let audit = std::fs::read_to_string(&result.audit_log_path).unwrap();
        assert!(!audit.contains("Fixture cleanup work"));
        assert!(!audit.contains("Remove session_index"));
    }

    #[test]
    fn rewrites_existing_index_file_without_leaving_temp_file() {
        let temp = assert_fs::TempDir::new().unwrap();
        temp.copy_from(fixture_root(), &["**/*"]).unwrap();
        let root = temp.path().to_path_buf();
        let session_id = "11111111-1111-4111-8111-111111111111".to_string();
        let plan = build_deletion_plan(&root, &[root.clone()], &[session_id.clone()]).unwrap();
        let planned_records = planned_index_records(&plan);
        let mut skipped = Vec::new();

        let removed = rewrite_index_without_sessions(
            &root,
            &[root.clone()],
            &[session_id.clone()],
            &planned_records,
            &mut skipped,
        )
        .unwrap();

        let index = std::fs::read_to_string(root.join("session_index.jsonl")).unwrap();
        assert_eq!(removed.len(), 1);
        assert!(!index.contains(&session_id));
        assert!(!root.join("session_index.jsonl.tmp").exists());
        assert!(skipped.is_empty());
    }

    #[test]
    fn rejects_index_and_audit_paths_outside_known_roots() {
        let safe_root = assert_fs::TempDir::new().unwrap();
        let unsafe_root = assert_fs::TempDir::new().unwrap();
        unsafe_root.copy_from(fixture_root(), &["**/*"]).unwrap();
        let codex_home = unsafe_root.path().to_path_buf();
        let session_id = "11111111-1111-4111-8111-111111111111".to_string();
        let plan = build_deletion_plan(&codex_home, &[codex_home.clone()], &[session_id]).unwrap();

        let err = execute_deletion_plan(&codex_home, &[safe_root.path().to_path_buf()], plan)
            .unwrap_err();

        assert!(err.to_string().contains("outside known Codex roots"));
        assert!(codex_home.join("session_index.jsonl").exists());
        assert!(!codex_home.join("codex-session-manager/audit.jsonl").exists());
    }

    #[test]
    fn missing_index_is_skipped_not_reported_deleted() {
        let temp = assert_fs::TempDir::new().unwrap();
        temp.copy_from(fixture_root(), &["**/*"]).unwrap();
        let root = temp.path().to_path_buf();
        let session_id = "11111111-1111-4111-8111-111111111111".to_string();
        let mut plan = build_deletion_plan(&root, &[root.clone()], &[session_id.clone()]).unwrap();
        std::fs::remove_file(root.join("session_index.jsonl")).unwrap();
        plan.items.retain(|item| item.kind == DeletionItemKind::IndexRecord);
        plan.freed_bytes = plan.items.iter().map(|item| item.size_bytes).sum();

        let result = execute_deletion_plan(&root, &[root.clone()], plan).unwrap();

        assert!(!result
            .deleted_items
            .iter()
            .any(|item| item.kind == DeletionItemKind::IndexRecord));
        assert!(result.deleted_session_ids.is_empty());
        assert!(result
            .skipped
            .iter()
            .any(|item| item.reason.contains("Index file not found")));
    }

    #[test]
    fn changed_index_row_with_same_id_is_preserved_and_skipped() {
        let temp = assert_fs::TempDir::new().unwrap();
        temp.copy_from(fixture_root(), &["**/*"]).unwrap();
        let root = temp.path().to_path_buf();
        let session_id = "11111111-1111-4111-8111-111111111111".to_string();
        let mut plan = build_deletion_plan(&root, &[root.clone()], &[session_id.clone()]).unwrap();
        let changed_row = "{\"id\":\"11111111-1111-4111-8111-111111111111\",\"thread_name\":\"Changed title\",\"updated_at\":\"2026-06-12T01:20:00Z\"}";
        std::fs::write(
            root.join("session_index.jsonl"),
            format!("{changed_row}\n"),
        )
        .unwrap();
        plan.items.retain(|item| item.kind == DeletionItemKind::IndexRecord);
        plan.freed_bytes = plan.items.iter().map(|item| item.size_bytes).sum();

        let result = execute_deletion_plan(&root, &[root.clone()], plan).unwrap();

        let index = std::fs::read_to_string(root.join("session_index.jsonl")).unwrap();
        assert!(index.contains(changed_row));
        assert!(!result
            .deleted_items
            .iter()
            .any(|item| item.kind == DeletionItemKind::IndexRecord));
        assert!(result.deleted_session_ids.is_empty());
        assert!(result
            .skipped
            .iter()
            .any(|item| item.reason.contains("changed since preview")));
        assert!(!result
            .skipped
            .iter()
            .any(|item| item.reason.contains("Changed title")));
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../fixtures/codex-home")
    }
}
