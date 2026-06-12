import type { CodexSession } from "./types";

export type SortMode = "updated-desc" | "updated-asc" | "size-desc" | "size-asc" | "title-asc";
export type GroupKey = "all" | "archived" | "unrecognized" | "abnormal" | `project:${string}`;

export interface SessionGroup {
  key: GroupKey;
  label: string;
  count: number;
  sizeBytes: number;
}

export function filterSessions(sessions: CodexSession[], query: string): CodexSession[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return sessions;
  }

  return sessions.filter((session) => {
    const haystack = [
      session.id,
      session.title,
      session.projectPath ?? "",
      session.messageSummary,
      session.status
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(normalized);
  });
}

export function sortSessions(sessions: CodexSession[], sortMode: SortMode): CodexSession[] {
  return [...sessions].sort((a, b) => {
    if (sortMode === "updated-desc") return compareDate(b.updatedAt, a.updatedAt);
    if (sortMode === "updated-asc") return compareDate(a.updatedAt, b.updatedAt);
    if (sortMode === "size-desc") return b.sizeBytes - a.sizeBytes;
    if (sortMode === "size-asc") return a.sizeBytes - b.sizeBytes;
    return a.title.localeCompare(b.title);
  });
}

export function groupSessions(sessions: CodexSession[]): SessionGroup[] {
  const groups = new Map<GroupKey, SessionGroup>();

  addGroup(groups, "all", "全部会话", sessions);
  addGroup(
    groups,
    "archived",
    "已归档",
    sessions.filter((session) => session.archived)
  );
  addGroup(
    groups,
    "unrecognized",
    "未识别项目",
    sessions.filter((session) => !session.projectPath)
  );
  addGroup(
    groups,
    "abnormal",
    "孤立或异常",
    sessions.filter((session) => session.status === "orphaned" || session.status === "abnormal")
  );

  const projectPaths = Array.from(
    new Set(sessions.map((session) => session.projectPath).filter((path): path is string => Boolean(path)))
  ).sort((a, b) => a.localeCompare(b));

  for (const projectPath of projectPaths) {
    addGroup(
      groups,
      `project:${projectPath}`,
      projectPath,
      sessions.filter((session) => session.projectPath === projectPath)
    );
  }

  return Array.from(groups.values()).filter((group) => group.key === "all" || group.count > 0);
}

export function sessionsForGroup(sessions: CodexSession[], groupKey: GroupKey): CodexSession[] {
  if (groupKey === "all") return sessions;
  if (groupKey === "archived") return sessions.filter((session) => session.archived);
  if (groupKey === "unrecognized") return sessions.filter((session) => !session.projectPath);
  if (groupKey === "abnormal") {
    return sessions.filter((session) => session.status === "orphaned" || session.status === "abnormal");
  }
  return sessions.filter((session) => session.projectPath === groupKey.slice("project:".length));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function addGroup(groups: Map<GroupKey, SessionGroup>, key: GroupKey, label: string, sessions: CodexSession[]) {
  groups.set(key, {
    key,
    label,
    count: sessions.length,
    sizeBytes: sessions.reduce((total, session) => total + session.sizeBytes, 0)
  });
}

function compareDate(a: string | null, b: string | null): number {
  return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime();
}
