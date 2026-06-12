use crate::errors::{io_error, AppError, AppResult};
use crate::models::CodexRoots;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

pub fn discover_roots_from_env() -> Vec<CodexRoots> {
    let mut roots = Vec::new();
    if let Ok(profile) = env::var("USERPROFILE") {
        let codex_home = PathBuf::from(profile).join(".codex");
        if codex_home.exists() {
            let app_data_roaming = env::var("APPDATA")
                .ok()
                .map(|path| PathBuf::from(path).join("Codex"))
                .filter(|path| path.exists());
            let app_data_local = env::var("LOCALAPPDATA")
                .ok()
                .map(|path| PathBuf::from(path).join("Codex"))
                .filter(|path| path.exists());
            roots.push(CodexRoots {
                codex_home,
                app_data_roaming,
                app_data_local,
            });
        }
    }
    roots
}

pub fn canonical_existing(path: &Path) -> AppResult<PathBuf> {
    fs::canonicalize(path).map_err(|source| io_error(path.to_path_buf(), source))
}

pub fn ensure_inside_roots(path: &Path, roots: &[PathBuf]) -> AppResult<PathBuf> {
    let canonical_path = canonical_existing(path)?;
    for root in roots {
        let canonical_root = canonical_existing(root)?;
        if canonical_path.starts_with(canonical_root) {
            return Ok(canonical_path);
        }
    }
    Err(AppError::PathOutsideRoot(canonical_path))
}

pub fn ensure_existing_or_parent_inside_roots(path: &Path, roots: &[PathBuf]) -> AppResult<PathBuf> {
    if path.exists() {
        return ensure_inside_roots(path, roots);
    }

    let parent = path
        .parent()
        .ok_or_else(|| AppError::Message(format!("path has no parent: {}", path.display())))?;
    let canonical_parent = ensure_inside_roots(parent, roots)?;
    let file_name = path
        .file_name()
        .ok_or_else(|| AppError::Message(format!("path has no file name: {}", path.display())))?;

    Ok(canonical_parent.join(file_name))
}

pub fn is_empty_directory(path: &Path) -> AppResult<bool> {
    let mut entries = fs::read_dir(path).map_err(|source| io_error(path.to_path_buf(), source))?;
    Ok(entries.next().is_none())
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::prelude::*;

    #[test]
    fn accepts_file_inside_known_root() {
        let root = assert_fs::TempDir::new().unwrap();
        let file = root.child("sessions/example.jsonl");
        file.write_str("{}").unwrap();

        let safe = ensure_inside_roots(file.path(), &[root.path().to_path_buf()]).unwrap();

        assert!(safe.ends_with("example.jsonl"));
    }

    #[test]
    fn rejects_file_outside_known_root() {
        let root = assert_fs::TempDir::new().unwrap();
        let other = assert_fs::TempDir::new().unwrap();
        let file = other.child("outside.jsonl");
        file.write_str("{}").unwrap();

        let err = ensure_inside_roots(file.path(), &[root.path().to_path_buf()]).unwrap_err();

        assert!(err.to_string().contains("outside known Codex roots"));
    }

    #[test]
    fn detects_empty_directory_without_recursive_delete() {
        let root = assert_fs::TempDir::new().unwrap();
        let empty = root.child("empty");
        empty.create_dir_all().unwrap();

        assert!(is_empty_directory(empty.path()).unwrap());

        let not_empty = root.child("not-empty");
        not_empty.create_dir_all().unwrap();
        not_empty.child("file.txt").write_str("x").unwrap();

        assert!(!is_empty_directory(not_empty.path()).unwrap());
    }
}
