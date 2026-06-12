import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { deleteSessions, previewDeleteSessions, revealInExplorer, scanSessions } from "./api";
import { DeletePreviewDialog } from "./components/DeletePreviewDialog";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { SessionDetails } from "./components/SessionDetails";
import { SessionTable } from "./components/SessionTable";
import {
  filterSessions,
  groupSessions,
  sessionsForGroup,
  sortSessions,
  type GroupKey,
  type SortMode
} from "./sessionFilters";
import type { CodexSession, DeletionPlan, ScanResult } from "./types";

const sortLabels: Record<SortMode, string> = {
  "updated-desc": "Updated newest",
  "updated-asc": "Updated oldest",
  "size-desc": "Size largest",
  "size-asc": "Size smallest",
  "title-asc": "Title A-Z"
};

export default function App() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<CodexSession | null>(null);
  const [deletePlan, setDeletePlan] = useState<DeletionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready to scan");

  const refresh = useCallback(async () => {
    setBusy(true);
    setStatus("Scanning sessions...");
    try {
      const result = await scanSessions();
      setScan(result);
      setFocused((current) => {
        if (!current) return result.sessions[0] ?? null;
        return result.sessions.find((session) => session.id === current.id) ?? result.sessions[0] ?? null;
      });
      setStatus(`Scanned ${result.sessions.length} sessions`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to scan sessions");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allSessions = scan?.sessions ?? [];
  const groups = useMemo(() => groupSessions(allSessions), [allSessions]);

  useEffect(() => {
    if (!groups.some((group) => group.key === selectedGroup)) {
      setSelectedGroup("all");
    }
  }, [groups, selectedGroup]);

  const visibleSessions = useMemo(() => {
    const grouped = sessionsForGroup(allSessions, selectedGroup);
    const filtered = filterSessions(grouped, query);
    return sortSessions(filtered, sortMode);
  }, [allSessions, query, selectedGroup, sortMode]);
  const visibleIds = useMemo(() => new Set(visibleSessions.map((session) => session.id)), [visibleSessions]);

  useEffect(() => {
    setFocused((current) => {
      if (visibleSessions.length === 0) return null;
      if (current && visibleIds.has(current.id)) return current;
      return visibleSessions[0];
    });
  }, [visibleIds, visibleSessions]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleIds]);

  const selectedSessions = useMemo(
    () => visibleSessions.filter((session) => selectedIds.has(session.id)),
    [selectedIds, visibleSessions]
  );

  const focusedSession = focused && visibleIds.has(focused.id) ? focused : visibleSessions[0] ?? null;

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function focusSession(session: CodexSession) {
    setFocused(session);
    if (selectedIds.size === 0) {
      setSelectedIds(new Set([session.id]));
    }
  }

  async function previewDelete() {
    const visibleSelectedIds = Array.from(selectedIds).filter((id) => visibleIds.has(id));
    const ids =
      visibleSelectedIds.length > 0
        ? visibleSelectedIds
        : focusedSession && visibleIds.has(focusedSession.id)
          ? [focusedSession.id]
          : [];
    if (ids.length === 0) return;

    setBusy(true);
    setStatus("Building deletion preview...");
    try {
      const plan = await previewDeleteSessions(ids);
      setDeletePlan(plan);
      setStatus(`Preview ready for ${plan.sessionIds.length} sessions`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to preview deletion");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deletePlan) return;

    setBusy(true);
    setStatus("Deleting selected sessions...");
    try {
      const result = await deleteSessions(deletePlan.sessionIds);
      setDeletePlan(null);
      setSelectedIds(new Set());
      setFocused(null);
      setStatus(`Deleted ${result.deletedSessionIds.length} sessions, freed ${result.freedBytes} bytes`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete selected sessions");
    } finally {
      setBusy(false);
    }
  }

  async function revealPath(path: string) {
    setBusy(true);
    setStatus("Opening path in Explorer...");
    try {
      await revealInExplorer(path);
      setStatus("Path opened in Explorer");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reveal path");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Codex Session Manager</h1>
          <p>{status}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Rescan sessions" onClick={refresh} disabled={busy}>
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search id, title, project, summary, status"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="sort-field">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="selection-count">{selectedSessions.length} selected</span>
      </div>

      <div className="workspace-grid">
        <ProjectSidebar groups={groups} selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
        <SessionTable
          sessions={visibleSessions}
          focusedId={focusedSession?.id ?? null}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          onFocus={focusSession}
        />
        <SessionDetails
          session={focusedSession}
          selectedCount={selectedSessions.length || (focusedSession ? 1 : 0)}
          busy={busy}
          onPreviewDelete={previewDelete}
          onRevealPath={revealPath}
        />
      </div>

      <DeletePreviewDialog
        plan={deletePlan}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeletePlan(null)}
      />
    </main>
  );
}
