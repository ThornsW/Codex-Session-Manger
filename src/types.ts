export type SessionStatus = "active" | "archived" | "orphaned" | "abnormal";

export interface DataSourceReport {
  discoveredRoots: string[];
  scannedRoots: string[];
  warnings: string[];
}

export interface CodexSession {
  id: string;
  title: string;
  projectPath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  archived: boolean;
  messageSummary: string;
  sessionFilePaths: string[];
  indexRecords: string[];
  derivedCachePaths: string[];
  sizeBytes: number;
  status: SessionStatus;
  warnings: string[];
}

export interface ScanResult {
  dataSourceReport: DataSourceReport;
  sessions: CodexSession[];
}

export interface DeletionItem {
  kind: "session_file" | "index_record" | "cache_file" | "empty_directory";
  path: string | null;
  description: string;
  sizeBytes: number;
  sessionId?: string | null;
  evidence?: string | null;
}

export interface SkippedDeletionItem {
  path: string | null;
  reason: string;
}

export interface DeletionPlan {
  sessionIds: string[];
  items: DeletionItem[];
  skipped: SkippedDeletionItem[];
  freedBytes: number;
}

export interface DeleteResult {
  deletedSessionIds: string[];
  deletedItems: DeletionItem[];
  skipped: SkippedDeletionItem[];
  freedBytes: number;
  auditLogPath: string;
}
