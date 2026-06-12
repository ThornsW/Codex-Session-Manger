import { describe, expect, it } from "vitest";
import type { CodexSession } from "./types";
import {
  filterSessions,
  formatBytes,
  groupSessions,
  sessionsForGroup,
  sortSessions
} from "./sessionFilters";

const sessions: CodexSession[] = [
  {
    id: "alpha-id",
    title: "Alpha cleanup",
    projectPath: "D:\\Library\\Alpha",
    createdAt: "2026-06-12T01:00:00Z",
    updatedAt: "2026-06-12T02:00:00Z",
    archived: false,
    messageSummary: "Delete old sessions",
    sessionFilePaths: ["a.jsonl"],
    indexRecords: [],
    derivedCachePaths: [],
    sizeBytes: 2048,
    status: "active",
    warnings: []
  },
  {
    id: "beta-id",
    title: "Beta review",
    projectPath: null,
    createdAt: "2026-06-11T01:00:00Z",
    updatedAt: "2026-06-11T02:00:00Z",
    archived: true,
    messageSummary: "Review preview",
    sessionFilePaths: ["b.jsonl"],
    indexRecords: [],
    derivedCachePaths: [],
    sizeBytes: 1048576,
    status: "archived",
    warnings: []
  },
  {
    id: "gamma-id",
    title: "Gamma orphan",
    projectPath: "D:\\Library\\Gamma",
    createdAt: "2026-06-10T01:00:00Z",
    updatedAt: null,
    archived: false,
    messageSummary: "Needs repair",
    sessionFilePaths: ["c.jsonl"],
    indexRecords: [],
    derivedCachePaths: [],
    sizeBytes: 512,
    status: "orphaned",
    warnings: ["Missing index"]
  }
];

describe("sessionFilters", () => {
  it("filters by title, summary, path, id, and status without matching case", () => {
    expect(filterSessions(sessions, "alpha").map((session) => session.id)).toEqual(["alpha-id"]);
    expect(filterSessions(sessions, "PREVIEW").map((session) => session.id)).toEqual(["beta-id"]);
    expect(filterSessions(sessions, "D:\\Library\\Gamma").map((session) => session.id)).toEqual(["gamma-id"]);
    expect(filterSessions(sessions, "beta-id").map((session) => session.id)).toEqual(["beta-id"]);
    expect(filterSessions(sessions, "ORPHANED").map((session) => session.id)).toEqual(["gamma-id"]);
  });

  it("groups null project paths and abnormal sessions", () => {
    const groups = groupSessions(sessions);

    expect(groups.find((group) => group.key === "all")).toMatchObject({ count: 3, sizeBytes: 1051136 });
    expect(groups.find((group) => group.key === "unrecognized")).toMatchObject({ count: 1 });
    expect(groups.find((group) => group.key === "abnormal")).toMatchObject({ count: 1 });
    expect(groups.find((group) => group.key === "project:D:\\Library\\Alpha")).toMatchObject({ count: 1 });
    expect(sessionsForGroup(sessions, "unrecognized").map((session) => session.id)).toEqual(["beta-id"]);
  });

  it("sorts by updated time, size, and title without mutating input", () => {
    expect(sortSessions(sessions, "updated-desc").map((session) => session.id)).toEqual([
      "alpha-id",
      "beta-id",
      "gamma-id"
    ]);
    expect(sortSessions(sessions, "updated-asc").map((session) => session.id)).toEqual([
      "gamma-id",
      "beta-id",
      "alpha-id"
    ]);
    expect(sortSessions(sessions, "size-desc").map((session) => session.id)).toEqual([
      "beta-id",
      "alpha-id",
      "gamma-id"
    ]);
    expect(sortSessions(sessions, "title-asc").map((session) => session.id)).toEqual([
      "alpha-id",
      "beta-id",
      "gamma-id"
    ]);
    expect(sessions.map((session) => session.id)).toEqual(["alpha-id", "beta-id", "gamma-id"]);
  });

  it("formats bytes using binary units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});
