import { invoke } from "@tauri-apps/api/core";
import type { DeleteResult, DeletionPlan, ScanResult } from "./types";

export function scanSessions(): Promise<ScanResult> {
  return invoke<ScanResult>("scan_sessions");
}

export function previewDeleteSessions(sessionIds: string[]): Promise<DeletionPlan> {
  return invoke<DeletionPlan>("preview_delete_sessions", { sessionIds });
}

export function deleteSessions(sessionIds: string[]): Promise<DeleteResult> {
  return invoke<DeleteResult>("delete_sessions", { sessionIds });
}

export function revealInExplorer(path: string): Promise<void> {
  return invoke<void>("reveal_in_explorer", { path });
}
