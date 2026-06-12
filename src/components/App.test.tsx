import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { DeletePreviewDialog } from "./DeletePreviewDialog";

const apiMocks = vi.hoisted(() => ({
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
  scanSessions: async () => ({
    dataSourceReport: {
      discoveredRoots: ["C:\\Users\\Fixture\\.codex"],
      scannedRoots: ["C:\\Users\\Fixture\\.codex"],
      warnings: []
    },
    sessions: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Fixture cleanup work",
        projectPath: "D:\\Library\\FixtureProject",
        createdAt: "2026-06-12T01:02:03Z",
        updatedAt: "2026-06-12T01:20:00Z",
        archived: false,
        messageSummary: "Clean this Codex project history.",
        sessionFilePaths: ["fixture.jsonl"],
        indexRecords: ["{}"],
        derivedCachePaths: [],
        sizeBytes: 2048,
        status: "active",
        warnings: []
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Archive review",
        projectPath: "D:\\Library\\ArchiveProject",
        createdAt: "2026-06-11T01:02:03Z",
        updatedAt: "2026-06-11T01:20:00Z",
        archived: false,
        messageSummary: "Review archived session history.",
        sessionFilePaths: ["archive.jsonl"],
        indexRecords: ["{}"],
        derivedCachePaths: [],
        sizeBytes: 4096,
        status: "active",
        warnings: []
      }
    ]
  }),
  previewDeleteSessions: apiMocks.previewDeleteSessions,
  deleteSessions: apiMocks.deleteSessions,
  revealInExplorer: apiMocks.revealInExplorer
}));

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMocks.previewDeleteSessions.mockClear();
    apiMocks.deleteSessions.mockClear();
    apiMocks.revealInExplorer.mockClear();
  });

  it("renders scanned sessions", async () => {
    render(<App />);

    expect((await screen.findAllByText("Fixture cleanup work")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("D:\\Library\\FixtureProject").length).toBeGreaterThan(0);
  });

  it("moves focus to the visible search result before previewing deletion", async () => {
    render(<App />);

    expect(await screen.findByText("Archive review")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search id, title, project, summary, status"), {
      target: { value: "Archive" }
    });

    const details = screen.getByLabelText("Session details");
    expect(within(details).getByText("Archive review")).toBeInTheDocument();
    expect(within(details).queryByText("Fixture cleanup work")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Preview delete session/i }));

    expect(apiMocks.previewDeleteSessions).toHaveBeenCalledWith(["22222222-2222-4222-8222-222222222222"]);
  });

  it("does not preview hidden selected sessions after filtering", async () => {
    render(<App />);

    fireEvent.click(await screen.findByLabelText("Select Fixture cleanup work"));
    fireEvent.change(screen.getByPlaceholderText("Search id, title, project, summary, status"), {
      target: { value: "Archive" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Preview delete session/i }));

    expect(apiMocks.previewDeleteSessions).toHaveBeenCalledWith(["22222222-2222-4222-8222-222222222222"]);
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

    const confirmButton = screen.getByRole("button", { name: /Delete selected sessions/i });
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

    expect(screen.getByRole("button", { name: /Delete selected sessions/i })).toBeDisabled();

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

    expect(screen.getByRole("button", { name: /Delete selected sessions/i })).toBeDisabled();
  });
});
