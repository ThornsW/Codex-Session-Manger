import type { CodexSession } from "../types";
import { formatBytes } from "../sessionFilters";
import { getSessionInstanceKey } from "../sessionIdentity";

interface Props {
  sessions: CodexSession[];
  focusedKey: string | null;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onFocus: (session: CodexSession) => void;
}

export function SessionTable({ sessions, focusedKey, selectedIds, onToggle, onFocus }: Props) {
  return (
    <section className="session-list" aria-label="会话列表">
      <div className="table-head">
        <span>标题</span>
        <span>更新时间</span>
        <span>大小</span>
      </div>
      <div className="table-body">
        {sessions.length === 0 ? (
          <div className="empty-state compact">没有符合当前筛选条件的会话。</div>
        ) : (
          sessions.map((session) => (
            <div
              className={getSessionInstanceKey(session) === focusedKey ? "session-row focused" : "session-row"}
              key={getSessionInstanceKey(session)}
              role="button"
              tabIndex={0}
              onClick={() => onFocus(session)}
              onKeyDown={(event) => {
                if (isInteractiveTarget(event.target)) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFocus(session);
                }
              }}
            >
              <input
                aria-label={`选择 ${session.title}`}
                type="checkbox"
                checked={selectedIds.has(session.id)}
                onChange={() => onToggle(session.id)}
                onClick={(event) => event.stopPropagation()}
              />
              <span className="session-main">
                <strong>{session.title}</strong>
                <span>{session.projectPath ?? "未识别项目"}</span>
              </span>
              <span className="session-updated">{formatUpdatedAt(session.updatedAt)}</span>
              <span className="session-size">{formatBytes(session.sizeBytes)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function formatUpdatedAt(updatedAt: string | null): string {
  if (!updatedAt) return "未知";
  return new Date(updatedAt).toLocaleString();
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("a, button, input, select, textarea"));
}
