# Codex Session Manager

Codex Session Manager is a personal Windows utility for scanning, grouping, previewing, and permanently cleaning local Codex App sessions. It is intended for local maintenance of your own Codex data, with deletion flows that show the impact before anything is removed.

## Safety Model

- The app scans first, then requires a deletion preview before cleanup.
- Rust validates paths before deletion.
- Deletion targets must remain inside known Codex data roots.
- Session files are deleted one file at a time.
- Empty directories are removed one at a time, and only when they are already empty.
- `session_index.jsonl` is rewritten only for rows confirmed by the cleanup selection.
- The audit log records deleted paths, skipped paths, session ids, and freed bytes without storing conversation content.
- Deletion is blocked when Codex appears to be running.

## Local Development

Frontend development needs Node.js:

```powershell
npm install
npm run test
npm run build
```

Running the Tauri app locally requires Rust and the Tauri prerequisites:

```powershell
npm run tauri dev
```

The preferred executable is the Windows build produced by GitHub Actions, so local Rust is not required for ordinary frontend and documentation work.

## Building the Windows Executable

Push to `master` or `main`, or manually run the `Build Windows Portable` workflow from GitHub Actions. The workflow builds and uploads the `codex-session-manager-windows` artifact.

Artifact paths:

- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/codex-session-manager.exe`

## Current Codex Data Surface

The current cleanup surface is limited to:

- `USERPROFILE\.codex\sessions\YYYY\MM\DD\*.jsonl`
- `USERPROFILE\.codex\archived_sessions`
- `USERPROFILE\.codex\session_index.jsonl`
- Related cache/index records only when they explicitly reference the selected session id.
