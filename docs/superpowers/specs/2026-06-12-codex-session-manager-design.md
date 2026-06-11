# Codex Session Manager Design

Date: 2026-06-12
Status: Approved for implementation planning

## Context

Codex App sessions can be archived, but local session data may continue to occupy disk space. As the number of sessions grows, it also becomes harder to find, classify, and clean a specific conversation. This project is a personal Windows utility for managing Codex App sessions clearly and safely.

The first version is intentionally scoped to the current user's local Codex App data format on this machine. It should be a portable Windows executable, not an installed app.

Reference projects considered:

- [a110q/CodexSessionKeeper](https://github.com/a110q/CodexSessionKeeper): session snapshot, restore, protection, and deletion-oriented workflows.
- [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus): Codex-adjacent data management ideas and app integration patterns.
- [xuanzhe1996/codex-chat-history-cleaner](https://github.com/xuanzhe1996/codex-chat-history-cleaner): local Codex history cleanup surface and deletion-oriented scripts.
- [farion1231/cc-switch](https://github.com/farion1231/cc-switch): local workflow management around Claude/Codex-style tooling.

## Goals

- Provide a simple Windows UI for managing Codex App sessions.
- Group sessions primarily by project or workspace path.
- Support search, sorting, and practical cleanup filters.
- Generate a deletion preview before permanent deletion.
- Cleanly delete session files and provably related index/cache records.
- Rescan after deletion so the UI reflects actual disk state.
- Build the final Windows portable executable through GitHub Actions so the local machine does not need a Rust toolchain.
- Local source editing should not require Rust. Local Tauri run/build still requires Rust, but the official portable executable is produced in GitHub Actions.

## Non-Goals

- No cloud sync.
- No multi-user profile management.
- No session content editing.
- No scheduled or automatic cleanup in the first version.
- No broad compatibility promise for every historical Codex data format.
- No installer, auto-updater, or background resident service.

## Technical Approach

Use Tauri, React, and TypeScript for the desktop app, with Rust for the local filesystem and data-management core.

The app has three layers:

1. React UI
   - Renders the project list, session table, details panel, deletion preview, and cleanup result.
   - Calls Tauri commands for scanning, preview generation, deletion, and rescanning.

2. Rust local core
   - Discovers Codex App data roots.
   - Parses session files, indexes, and metadata for the current local format.
   - Builds normalized session models.
   - Computes deletion plans.
   - Executes deletion plans with path-boundary checks and audit logging.

3. GitHub Actions build
   - Runs the Windows build on a GitHub-hosted runner.
   - Produces a portable `.exe` artifact.
   - Keeps Rust compilation off the local machine.

## UI Design

The main screen uses a three-column tool layout.

Left column: project groups

- All sessions.
- Project or workspace path groups.
- Unrecognized project.
- Archived sessions.
- Orphaned or abnormal sessions.
- Each group displays session count and total disk usage.

Middle column: session list

- Search by title, path, message excerpt, and session id.
- Sort by updated time, size, message count, and title.
- Filter by archived state, large sessions, abnormal sessions, or unrecognized project.
- Rows show title, project path, updated time, size, and status tags.

Right column: session details

- First and recent message excerpts.
- Session file path.
- Related index records.
- Estimated deletion items.
- Estimated freed disk space.
- Actions: delete, reveal in Explorer, rescan.

## Deletion Workflow

Deletion is permanent, but always previewed first.

1. User selects one or more sessions.
2. User clicks delete.
3. The Rust core generates a deletion plan in dry-run mode.
4. The UI shows all planned session files, index records, derived cache files, and skipped uncertain items.
5. User confirms the plan.
6. The Rust core checks that Codex is not running.
7. The Rust core executes the deletion plan.
8. The app writes an audit log entry.
9. The scanner runs again.
10. The UI shows deleted session count, freed space, and skipped items.

## Data Model

Each session is normalized into:

- `id`
- `title`
- `project_path`
- `created_at`
- `updated_at`
- `archived`
- `message_summary`
- `session_file_paths`
- `index_records`
- `derived_cache_paths`
- `size_bytes`
- `status`
- `warnings`

Project grouping priority:

1. Explicit workspace or project path from session metadata.
2. Path embedded in session files or indexes.
3. Inference from file location.
4. Inference from first-message or metadata content.
5. `Unrecognized` when confidence is insufficient.

## Scanning Strategy

The first run creates a local data-source report.

Default discovery checks:

- `%USERPROFILE%\.codex`
- Codex App local application data directories.
- Known session, index, cache, and metadata subdirectories discovered on this machine.

If automatic discovery fails, the user can choose the Codex data root manually.

The scanner must tolerate unknown files and partial data. Unknown or locked files become warnings instead of fatal errors.

## Clean Deletion Rules

Deletion plans may include only items that can be proven to belong to the selected session.

Allowed deletion targets:

- Session JSON or JSONL files for the selected session.
- Index records explicitly referencing the selected session id.
- Cache or snapshot files explicitly derived from the selected session id.
- Empty parent directories only when they are inside a known Codex data root and empty after deletion.
- Empty directories are removed one at a time; the app must not use recursive directory deletion.

Skipped targets:

- Files with ambiguous ownership.
- Shared index records.
- Unknown schema records.
- Locked files.
- Paths outside known Codex data roots.
- Any item whose relationship to the selected session cannot be proven.

The app must never do broad pattern deletion. Every deleted item must come from a concrete deletion plan.

## Safety and Audit

- Default mode is scan and preview, not immediate deletion.
- If Codex is running, deletion is blocked and the user is asked to close Codex first.
- Path canonicalization is required before deletion.
- All deletion paths must stay inside known Codex data roots.
- The app writes an audit log with timestamp, session id, deleted paths, skipped paths, and freed bytes.
- The audit log must not store conversation content.
- Errors are reported per item so partial failures remain understandable.

## Testing Strategy

Core tests:

- Fixture-based scanning of fake Codex data roots.
- Project grouping inference.
- Session size calculation.
- Deletion-plan generation.
- Path-boundary checks.
- Permanent deletion only inside temporary test directories.
- Handling locked, missing, malformed, and unknown files.

UI tests:

- Search.
- Sorting.
- Filtering.
- Selection and multi-selection.
- Deletion preview.
- Cleanup result display.

Build verification:

- GitHub Actions Windows build.
- Portable executable artifact upload.

## First Implementation Scope

The first implementation should deliver:

- Tauri app scaffold.
- React three-column UI.
- Local scanner for the current machine's Codex data format.
- Normalized session model.
- Project grouping by workspace path.
- Search, sorting, and basic filters.
- Deletion preview.
- Permanent clean deletion from a confirmed deletion plan.
- Audit log.
- Post-delete rescan.
- GitHub Actions workflow for Windows portable executable artifact.
