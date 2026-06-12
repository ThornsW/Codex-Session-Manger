mod audit;
mod deletion;
mod errors;
mod jsonl;
mod models;
mod paths;
mod process;
mod scanner;

#[cfg(test)]
mod test_fixtures;

#[tauri::command]
fn scan_sessions() -> Result<models::ScanResult, String> {
    let roots = paths::discover_roots_from_env();
    if let Some(root) = roots.first() {
        scanner::scan_codex_home(&root.codex_home).map_err(|err| err.to_string())
    } else {
        Ok(models::ScanResult {
            data_source_report: models::DataSourceReport {
                discovered_roots: vec![],
                scanned_roots: vec![],
                warnings: vec!["No Codex home was discovered under USERPROFILE\\.codex.".to_string()],
            },
            sessions: vec![],
        })
    }
}

#[tauri::command]
fn preview_delete_sessions(session_ids: Vec<String>) -> Result<models::DeletionPlan, String> {
    let roots = paths::discover_roots_from_env();
    let Some(root) = roots.first() else {
        return Ok(models::DeletionPlan {
            session_ids,
            items: vec![],
            skipped: vec![models::SkippedDeletionItem {
                path: None,
                reason: "No Codex home was discovered under USERPROFILE\\.codex.".to_string(),
            }],
            freed_bytes: 0,
        });
    };
    let known_roots = vec![root.codex_home.clone()];
    deletion::build_deletion_plan(&root.codex_home, &known_roots, &session_ids)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn delete_sessions(plan: models::DeletionPlan) -> Result<models::DeleteResult, String> {
    if process::is_codex_running() {
        return Err("Codex appears to be running. Close Codex before deleting sessions.".to_string());
    }
    let roots = paths::discover_roots_from_env();
    let Some(root) = roots.first() else {
        return Err("No Codex home was discovered under USERPROFILE\\.codex.".to_string());
    };
    let known_roots = vec![root.codex_home.clone()];
    deletion::execute_deletion_plan(&root.codex_home, &known_roots, plan)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn reveal_in_explorer(_path: String) -> Result<(), String> {
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_sessions,
            preview_delete_sessions,
            delete_sessions,
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Codex Session Manager");
}
