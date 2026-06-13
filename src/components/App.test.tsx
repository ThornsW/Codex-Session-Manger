import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { CodexSession } from "../types";
import { DeletePreviewDialog } from "./DeletePreviewDialog";
import { ProjectSidebar } from "./ProjectSidebar";
import { SessionTable } from "./SessionTable";

const apiMocks = vi.hoisted(() => ({
  scanSessions: vi.fn(),
  previewDeleteSessions: vi.fn(async (sessionIds: string[]) => ({
    sessionIds,
    items: [
      {
        kind: "session_file" as const,
        path: "fixture.jsonl",
        description: "Fixture session file",
        sizeBytes: 2048
      }
    ],
    skipped: [],
    freedBytes: 2048
  })),
  deleteSessions: vi.fn(async (sessionIds: string[]) => ({
    deletedSessionIds: sessionIds,
    deletedItems: [],
    skipped: [],
    freedBytes: 0,
    auditLogPath: "audit.jsonl"
  })),
  revealInExplorer: vi.fn(async () => undefined)
}));

vi.mock("../api", () => ({
  scanSessions: apiMocks.scanSessions,
  previewDeleteSessions: apiMocks.previewDeleteSessions,
  deleteSessions: apiMocks.deleteSessions,
  revealInExplorer: apiMocks.revealInExplorer
}));

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMocks.scanSessions.mockImplementation(defaultScanSessions);
    apiMocks.previewDeleteSessions.mockClear();
    apiMocks.deleteSessions.mockClear();
    apiMocks.revealInExplorer.mockClear();
  });

  it("renders scanned sessions", async () => {
    render(<App />);

    expect((await screen.findAllByText("Fixture cleanup work")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("D:\\Library\\FixtureProject").length).toBeGreaterThan(0);
    expect(screen.getByText("Codex 会话管理器")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索 ID、标题、项目、摘要、状态")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新扫描会话" })).toBeInTheDocument();
    expect(screen.getByText("全部会话")).toBeInTheDocument();
    expect(screen.getByText("排序")).toBeInTheDocument();
    expect(screen.getByText("0 个已选择")).toBeInTheDocument();
  });

  it("moves focus to the visible search result before previewing deletion", async () => {
    render(<App />);

    expect(await screen.findByText("Archive review")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索 ID、标题、项目、摘要、状态"), {
      target: { value: "Archive" }
    });

    const details = screen.getByLabelText("会话详情");
    expect(within(details).getByText("Archive review")).toBeInTheDocument();
    expect(within(details).queryByText("Fixture cleanup work")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /预览删除/ }));

    expect(apiMocks.previewDeleteSessions).toHaveBeenCalledWith(["22222222-2222-4222-8222-222222222222"]);
  });

  it("does not preview hidden selected sessions after filtering", async () => {
    render(<App />);

    fireEvent.click(await screen.findByLabelText("选择 Fixture cleanup work"));
    fireEvent.change(screen.getByPlaceholderText("搜索 ID、标题、项目、摘要、状态"), {
      target: { value: "Archive" }
    });
    fireEvent.click(screen.getByRole("button", { name: /预览删除/ }));

    expect(apiMocks.previewDeleteSessions).toHaveBeenCalledWith(["22222222-2222-4222-8222-222222222222"]);
  });

  it("filters the session list when a project group is selected", async () => {
    render(<App />);

    expect(await screen.findByLabelText("选择 Fixture cleanup work")).toBeInTheDocument();

    const sidebar = screen.getByLabelText("项目分组");
    fireEvent.click(within(sidebar).getByRole("button", { name: /D:\\Library\\ArchiveProject/ }));

    const sessionList = screen.getByLabelText("会话列表");
    expect(await within(sessionList).findByText("Archive review")).toBeInTheDocument();
    expect(within(sessionList).queryByText("Fixture cleanup work")).not.toBeInTheDocument();

    const details = screen.getByLabelText("会话详情");
    expect(within(details).getByText("Archive review")).toBeInTheDocument();
    expect(within(details).getByText("D:\\Library\\ArchiveProject")).toBeInTheDocument();
  });

  it("moves focus to the selected project when metadata ids collide", async () => {
    apiMocks.scanSessions.mockResolvedValueOnce({
      dataSourceReport: {
        discoveredRoots: ["C:\\Users\\Fixture\\.codex"],
        scannedRoots: ["C:\\Users\\Fixture\\.codex"],
        warnings: []
      },
      sessions: [
        sessionFixture({
          id: "duplicate-id",
          title: "LosAngeles stale row",
          projectPath: "D:\\Library\\LosAngeles_vps",
          updatedAt: "2026-06-11T14:21:20Z",
          sessionFilePaths: ["los-angeles.jsonl"],
          sizeBytes: 1_700_000
        }),
        sessionFixture({
          id: "duplicate-id",
          title: "Selected project row",
          projectPath: "C:\\Users\\Thorns\\.codex\\worktrees\\0689\\Codex-Session-Manger",
          updatedAt: "2026-06-13T15:29:53Z",
          sessionFilePaths: ["selected-project.jsonl"],
          sizeBytes: 427_400
        })
      ]
    });
    render(<App />);

    const sessionList = screen.getByLabelText("会话列表");
    expect(await within(sessionList).findByText("LosAngeles stale row")).toBeInTheDocument();

    const sidebar = screen.getByLabelText("项目分组");
    fireEvent.click(within(sidebar).getByRole("button", { name: /Codex-Session-Manger/ }));

    const filteredSessionList = screen.getByLabelText("会话列表");
    expect(await within(filteredSessionList).findByText("Selected project row")).toBeInTheDocument();
    expect(within(filteredSessionList).queryByText("LosAngeles stale row")).not.toBeInTheDocument();

    const details = screen.getByLabelText("会话详情");
    expect(within(details).getByText("Selected project row")).toBeInTheDocument();
    expect(within(details).getByText("C:\\Users\\Thorns\\.codex\\worktrees\\0689\\Codex-Session-Manger")).toBeInTheDocument();
    expect(within(details).queryByText("D:\\Library\\LosAngeles_vps")).not.toBeInTheDocument();
  });

  it("highlights only the focused row when metadata ids collide", async () => {
    apiMocks.scanSessions.mockResolvedValueOnce({
      dataSourceReport: {
        discoveredRoots: ["C:\\Users\\Fixture\\.codex"],
        scannedRoots: ["C:\\Users\\Fixture\\.codex"],
        warnings: []
      },
      sessions: [
        sessionFixture({
          id: "duplicate-id",
          title: "LosAngeles stale row",
          projectPath: "D:\\Library\\LosAngeles_vps",
          sessionFilePaths: ["los-angeles.jsonl"]
        }),
        sessionFixture({
          id: "duplicate-id",
          title: "Selected project row",
          projectPath: "C:\\Users\\Thorns\\.codex\\worktrees\\0689\\Codex-Session-Manger",
          sessionFilePaths: ["selected-project.jsonl"]
        })
      ]
    });
    render(<App />);

    const sessionList = screen.getByLabelText("会话列表");
    expect(await within(sessionList).findByText("LosAngeles stale row")).toBeInTheDocument();

    const focusedRows = within(sessionList)
      .getAllByRole("button")
      .filter((row) => row.classList.contains("focused"));
    expect(focusedRows).toHaveLength(1);
    expect(within(focusedRows[0]).getByText("LosAngeles stale row")).toBeInTheDocument();
  });

  it("confirms deletion with the reviewed preview plan", async () => {
    const plannedItem = {
      kind: "session_file" as const,
      path: "reviewed-fixture.jsonl",
      description: "Reviewed fixture session file",
      sizeBytes: 4096,
      evidence: "reviewed-plan-token"
    };
    apiMocks.previewDeleteSessions.mockResolvedValueOnce({
      sessionIds: ["11111111-1111-4111-8111-111111111111"],
      items: [plannedItem],
      skipped: [],
      freedBytes: 4096
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /预览删除/ }));
    await screen.findByText("Reviewed fixture session file");
    fireEvent.click(screen.getByRole("button", { name: /删除选中的会话/ }));

    expect(apiMocks.deleteSessions).toHaveBeenCalledWith({
      sessionIds: ["11111111-1111-4111-8111-111111111111"],
      items: [plannedItem],
      skipped: [],
      freedBytes: 4096
    });
  });
});

describe("DeletePreviewDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables destructive confirm without concrete deletion items and session ids", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeletePreviewDialog
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        plan={{
          sessionIds: ["11111111-1111-4111-8111-111111111111"],
          items: [],
          skipped: [],
          freedBytes: 0
        }}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /删除选中的会话/ });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(
      <DeletePreviewDialog
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        plan={{
          sessionIds: [],
          items: [
            {
              kind: "session_file",
              path: "fixture.jsonl",
              description: "Fixture session file",
              sizeBytes: 2048
            }
          ],
          skipped: [],
          freedBytes: 2048
        }}
      />
    );

    expect(screen.getByRole("button", { name: /删除选中的会话/ })).toBeDisabled();

    rerender(
      <DeletePreviewDialog
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        plan={{
          sessionIds: ["11111111-1111-4111-8111-111111111111"],
          items: [
            {
              kind: "index_record",
              path: null,
              description: "Index-only record",
              sizeBytes: 0
            }
          ],
          skipped: [],
          freedBytes: 0
        }}
      />
    );

    expect(screen.getByRole("button", { name: /删除选中的会话/ })).toBeDisabled();
  });
});

describe("SessionTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps rows distinct when Codex metadata ids collide", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(
        <SessionTable
          sessions={[
            sessionFixture({
              id: "duplicate-id",
              title: "LosAngeles stale row",
              projectPath: "D:\\Library\\LosAngeles_vps",
              sessionFilePaths: ["los-angeles.jsonl"]
            }),
            sessionFixture({
              id: "duplicate-id",
              title: "Selected project row",
              projectPath: "C:\\Users\\Thorns\\.codex\\worktrees\\0689\\Codex-Session-Manger",
              sessionFilePaths: ["selected-project.jsonl"]
            })
          ]}
          focusedKey={null}
          selectedIds={new Set()}
          onToggle={vi.fn()}
          onFocus={vi.fn()}
        />
      );

      expect(screen.getByText("LosAngeles stale row")).toBeInTheDocument();
      expect(screen.getByText("Selected project row")).toBeInTheDocument();
      expect(consoleError.mock.calls.some((call) => call.some(isDuplicateKeyWarning))).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("ProjectSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks only the active group as the current session filter", () => {
    const onSelectGroup = vi.fn();
    render(
      <ProjectSidebar
        groups={[
          { key: "all", label: "全部会话", count: 2, sizeBytes: 6144 },
          {
            key: "project:D:\\Library\\FixtureProject",
            label: "D:\\Library\\FixtureProject",
            count: 1,
            sizeBytes: 2048
          }
        ]}
        selectedGroup={"project:D:\\Library\\FixtureProject"}
        onSelectGroup={onSelectGroup}
      />
    );

    const projectButton = screen.getByRole("button", { name: /D:\\Library\\FixtureProject/ });
    expect(projectButton).toHaveClass("selected");
    expect(projectButton).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /全部会话/ })).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: /全部会话/ }));
    expect(onSelectGroup).toHaveBeenCalledWith("all");
  });
});

function sessionFixture(overrides: Partial<CodexSession>): CodexSession {
  return {
    id: "fixture-id",
    title: "Fixture session",
    projectPath: "D:\\Library\\FixtureProject",
    createdAt: "2026-06-12T01:02:03Z",
    updatedAt: "2026-06-12T01:20:00Z",
    archived: false,
    messageSummary: "Fixture message summary.",
    sessionFilePaths: ["fixture.jsonl"],
    indexRecords: ["{}"],
    derivedCachePaths: [],
    sizeBytes: 2048,
    status: "active",
    warnings: [],
    ...overrides
  };
}

function isDuplicateKeyWarning(message: unknown): boolean {
  return typeof message === "string" && message.includes("same key");
}

async function defaultScanSessions() {
  return {
    dataSourceReport: {
      discoveredRoots: ["C:\\Users\\Fixture\\.codex"],
      scannedRoots: ["C:\\Users\\Fixture\\.codex"],
      warnings: []
    },
    sessions: [
      sessionFixture({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Fixture cleanup work",
        projectPath: "D:\\Library\\FixtureProject",
        messageSummary: "Clean this Codex project history.",
        sessionFilePaths: ["fixture.jsonl"],
        sizeBytes: 2048
      }),
      sessionFixture({
        id: "22222222-2222-4222-8222-222222222222",
        title: "Archive review",
        projectPath: "D:\\Library\\ArchiveProject",
        createdAt: "2026-06-11T01:02:03Z",
        updatedAt: "2026-06-11T01:20:00Z",
        messageSummary: "Review archived session history.",
        sessionFilePaths: ["archive.jsonl"],
        sizeBytes: 4096
      })
    ]
  };
}
