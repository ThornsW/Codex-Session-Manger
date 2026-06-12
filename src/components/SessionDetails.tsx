import { ExternalLink, Trash2 } from "lucide-react";
import { formatBytes } from "../sessionFilters";
import type { CodexSession } from "../types";

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
      <aside className="details-pane" aria-label="Session details">
        <div className="panel-title">Details</div>
        <div className="empty-state compact">Select a session to inspect paths and cleanup impact.</div>
      </aside>
    );
  }

  const revealPaths = [
    ...session.sessionFilePaths,
    ...session.derivedCachePaths,
    ...session.indexRecords.filter((record) => record.includes("\\") || record.includes("/"))
  ];

  return (
    <aside className="details-pane" aria-label="Session details">
      <div className="details-header">
        <div>
          <div className="panel-title">Details</div>
          <h2>{session.title}</h2>
        </div>
        <span className={`status-pill ${session.status}`}>{session.status}</span>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Session ID</dt>
          <dd>{session.id}</dd>
        </div>
        <div>
          <dt>Project</dt>
          <dd>{session.projectPath ?? "Unrecognized project"}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{session.updatedAt ? new Date(session.updatedAt).toLocaleString() : "Unknown"}</dd>
        </div>
        <div>
          <dt>Estimated size</dt>
          <dd>{formatBytes(session.sizeBytes)}</dd>
        </div>
      </dl>

      <section className="detail-section">
        <h3>Summary</h3>
        <p>{session.messageSummary || "No summary available."}</p>
      </section>

      <PathList title="Session files" paths={session.sessionFilePaths} onRevealPath={onRevealPath} />
      <PathList title="Derived cache" paths={session.derivedCachePaths} onRevealPath={onRevealPath} />

      <section className="detail-section">
        <h3>Index records</h3>
        {session.indexRecords.length === 0 ? (
          <p className="muted">No index records reported.</p>
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
          <h3>Warnings</h3>
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
          Preview delete {selectedCount > 1 ? `${selectedCount} sessions` : "session"}
        </button>
        {revealPaths[0] ? (
          <button type="button" className="secondary-button" onClick={() => onRevealPath(revealPaths[0])} disabled={busy}>
            <ExternalLink size={16} aria-hidden="true" />
            Reveal first path
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
        <p className="muted">None reported.</p>
      ) : (
        <ul className="path-list">
          {paths.map((path) => (
            <li key={path}>
              <span>{path}</span>
              <button type="button" className="path-action" onClick={() => onRevealPath(path)} aria-label={`Reveal ${path}`}>
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
