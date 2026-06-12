#[tauri::command]
fn scan_sessions() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "dataSourceReport": {
            "discoveredRoots": [],
            "scannedRoots": [],
            "warnings": ["Scanner is not implemented yet."]
        },
        "sessions": []
    }))
}

#[tauri::command]
fn preview_delete_sessions(session_ids: Vec<String>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "sessionIds": session_ids,
        "items": [],
        "skipped": [],
        "freedBytes": 0
    }))
}

#[tauri::command]
fn delete_sessions(session_ids: Vec<String>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "deletedSessionIds": session_ids,
        "deletedItems": [],
        "skipped": [],
        "freedBytes": 0,
        "auditLogPath": ""
    }))
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
