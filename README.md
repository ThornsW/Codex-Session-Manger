# Codex Session Manager

Personal Windows utility for scanning, grouping, previewing, and permanently cleaning local Codex App sessions.

## Safety Model

- The app scans first and deletes only after a deletion preview.
- Rust validates paths before deletion.
- Deletion targets must stay inside discovered Codex data roots.
- Session files are removed with single-file deletion.
- Empty directories are removed one at a time only when already empty.
- The app rewrites `session_index.jsonl` to remove confirmed session rows.
- The audit log stores deleted paths, skipped paths, session ids, and freed bytes. It does not store conversation content.
- If Codex appears to be running, deletion is blocked.

## Local Development

Frontend-only work needs Node.js:

```powershell
npm install
npm run test
npm run build
```

Running or building the Tauri app locally requires Rust and the Tauri prerequisites:

```powershell
npm run tauri dev
```

The preferred Windows executable is built in GitHub Actions, so this machine does not need Rust for normal source editing.

## Building the Windows Executable

Push to `master` or `main`, or run the `Build Windows Portable` workflow manually.

Artifacts:

- `src-tauri/target/release/codex-session-manager.exe`
- `src-tauri/target/release/bundle/nsis/*.exe`

## Current Codex Data Surface

The first version targets this machine's current Codex data shape:

- `%USERPROFILE%\.codex\sessions\YYYY\MM\DD\*.jsonl`
- `%USERPROFILE%\.codex\archived_sessions`
- `%USERPROFILE%\.codex\session_index.jsonl`
- Related cache/index records only when they explicitly reference a selected session id.
