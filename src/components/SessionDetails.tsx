import { ExternalLink, Trash2 } from "lucide-react";
import { formatBytes } from "../sessionFilters";
import type { CodexSession, SessionStatus } from "../types";

interface Props {
  session: CodexSession | null;
  selectedCount: number;
  busy: boolean;
  onPreviewDelete: () => void;
  onRevealPath: (path: string) => void;
}

export function SessionDetails({ session, selectedCount, busy, onPreviewDelete, onRevealPath }: Props) {
  if (!session) {
    return (
      <aside className="details-pane" aria-label="会话详情">
        <div className="panel-title">详情</div>
        <div className="empty-state compact">选择一个会话以查看路径和清理影响。</div>
      </aside>
    );
  }

  const revealPaths = [
    ...session.sessionFilePaths,
    ...session.derivedCachePaths,
    ...session.indexRecords.filter((record) => record.includes("\\") || record.includes("/"))
  ];

  return (
    <aside className="details-pane" aria-label="会话详情">
      <div className="details-header">
        <div>
          <div className="panel-title">详情</div>
          <h2>{session.title}</h2>
        </div>
        <span className={`status-pill ${session.status}`}>{statusLabel(session.status)}</span>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>会话 ID</dt>
          <dd>{session.id}</dd>
        </div>
        <div>
          <dt>项目</dt>
          <dd>{session.projectPath ?? "未识别项目"}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{session.updatedAt ? new Date(session.updatedAt).toLocaleString() : "未知"}</dd>
        </div>
        <div>
          <dt>预估大小</dt>
          <dd>{formatBytes(session.sizeBytes)}</dd>
        </div>
      </dl>

      <section className="detail-section">
        <h3>摘要</h3>
        <p>{session.messageSummary || "暂无摘要。"}</p>
      </section>

      <PathList title="会话文件" paths={session.sessionFilePaths} onRevealPath={onRevealPath} />
      <PathList title="派生缓存" paths={session.derivedCachePaths} onRevealPath={onRevealPath} />

      <section className="detail-section">
        <h3>索引记录</h3>
        {session.indexRecords.length === 0 ? (
          <p className="muted">没有索引记录。</p>
        ) : (
          <ul className="path-list">
            {session.indexRecords.map((record, index) => (
              <li key={`${record}-${index}`}>{record}</li>
            ))}
          </ul>
        )}
      </section>

      {session.warnings.length > 0 ? (
        <section className="detail-section">
          <h3>警告</h3>
          <ul className="path-list warning-list">
            {session.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="details-actions">
        <button type="button" className="danger-button" onClick={onPreviewDelete} disabled={busy || selectedCount === 0}>
          <Trash2 size={16} aria-hidden="true" />
          预览删除{selectedCount > 1 ? ` ${selectedCount} 个会话` : "当前会话"}
        </button>
        {revealPaths[0] ? (
          <button type="button" className="secondary-button" onClick={() => onRevealPath(revealPaths[0])} disabled={busy}>
            <ExternalLink size={16} aria-hidden="true" />
            打开首个路径
          </button>
        ) : null}
      </div>
    </aside>
  );
}

interface PathListProps {
  title: string;
  paths: string[];
  onRevealPath: (path: string) => void;
}

function PathList({ title, paths, onRevealPath }: PathListProps) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {paths.length === 0 ? (
        <p className="muted">无记录。</p>
      ) : (
        <ul className="path-list">
          {paths.map((path) => (
            <li key={path}>
              <span>{path}</span>
              <button type="button" className="path-action" onClick={() => onRevealPath(path)} aria-label={`打开 ${path}`}>
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function statusLabel(status: SessionStatus): string {
  if (status === "active") return "活动";
  if (status === "archived") return "已归档";
  if (status === "orphaned") return "孤立";
  return "异常";
}
