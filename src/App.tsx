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
import { getSessionInstanceKey } from "./sessionIdentity";
import type { CodexSession, DeletionPlan, ScanResult } from "./types";

const sortLabels: Record<SortMode, string> = {
  "updated-desc": "最近更新",
  "updated-asc": "最早更新",
  "size-desc": "体积从大到小",
  "size-asc": "体积从小到大",
  "title-asc": "标题 A-Z"
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
  const [status, setStatus] = useState("准备扫描");

  const refresh = useCallback(async () => {
    setBusy(true);
    setStatus("正在扫描会话...");
    try {
      const result = await scanSessions();
      setScan(result);
      setFocused((current) => {
        if (!current) return result.sessions[0] ?? null;
        return result.sessions.find((session) => session.id === current.id) ?? result.sessions[0] ?? null;
      });
      setStatus(`扫描到 ${result.sessions.length} 个会话`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "扫描会话失败");
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
  const visibleInstanceKeys = useMemo(
    () => new Set(visibleSessions.map(getSessionInstanceKey)),
    [visibleSessions]
  );

  useEffect(() => {
    setFocused((current) => {
      if (visibleSessions.length === 0) return null;
      if (current && visibleInstanceKeys.has(getSessionInstanceKey(current))) return current;
      return visibleSessions[0];
    });
  }, [visibleInstanceKeys, visibleSessions]);

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

  const focusedSession =
    focused && visibleInstanceKeys.has(getSessionInstanceKey(focused)) ? focused : visibleSessions[0] ?? null;

  const selectGroup = useCallback((group: GroupKey) => {
    setSelectedGroup(group);
    setSelectedIds(new Set());
    setFocused(null);
  }, []);

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
    setStatus("正在生成删除预览...");
    try {
      const plan = await previewDeleteSessions(ids);
      setDeletePlan(plan);
      setStatus(`已生成 ${plan.sessionIds.length} 个会话的删除预览`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成删除预览失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deletePlan) return;

    setBusy(true);
    setStatus("正在删除选中的会话...");
    try {
      const result = await deleteSessions(deletePlan);
      setDeletePlan(null);
      setSelectedIds(new Set());
      setFocused(null);
      setStatus(`已删除 ${result.deletedSessionIds.length} 个会话，释放 ${result.freedBytes} 字节`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除选中的会话失败");
    } finally {
      setBusy(false);
    }
  }

  async function revealPath(path: string) {
    setBusy(true);
    setStatus("正在资源管理器中打开路径...");
    try {
      await revealInExplorer(path);
      setStatus("路径已在资源管理器中打开");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "打开路径失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Codex 会话管理器</h1>
          <p>{status}</p>
        </div>
        <button type="button" className="icon-button" aria-label="重新扫描会话" onClick={refresh} disabled={busy}>
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="搜索 ID、标题、项目、摘要、状态"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="sort-field">
          <span>排序</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="selection-count">{selectedSessions.length} 个已选择</span>
      </div>

      <div className="workspace-grid">
        <ProjectSidebar groups={groups} selectedGroup={selectedGroup} onSelectGroup={selectGroup} />
        <SessionTable
          key={selectedGroup}
          sessions={visibleSessions}
          focusedKey={focusedSession ? getSessionInstanceKey(focusedSession) : null}
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
