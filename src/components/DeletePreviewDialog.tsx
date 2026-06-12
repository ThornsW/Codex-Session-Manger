import { Trash2, X } from "lucide-react";
import { formatBytes } from "../sessionFilters";
import type { DeletionPlan } from "../types";

interface Props {
  plan: DeletionPlan | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeletePreviewDialog({ plan, busy, onConfirm, onCancel }: Props) {
  if (!plan) return null;

  const canConfirm = !busy && plan.sessionIds.length > 0 && plan.items.some(hasConcretePath);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-preview-title">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Deletion preview</p>
            <h2 id="delete-preview-title">Review {plan.items.length} planned items</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close delete preview" disabled={busy}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="dialog-summary">
          <span>{plan.sessionIds.length} sessions</span>
          <span>{formatBytes(plan.freedBytes)} estimated freed</span>
          <span>{plan.skipped.length} skipped</span>
        </div>

        <div className="dialog-list">
          {plan.items.length === 0 ? (
            <p className="muted">No deletable items were found for this preview.</p>
          ) : (
            <ul className="path-list">
              {plan.items.map((item, index) => (
                <li key={`${item.kind}-${item.path ?? index}`}>
                  <span>
                    <strong>{item.description}</strong>
                    <small>
                      {item.kind} / {formatBytes(item.sizeBytes)}
                    </small>
                    <span>{item.path ?? "No concrete path"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {plan.skipped.length > 0 ? (
          <div className="dialog-list skipped">
            <h3>Skipped</h3>
            <ul className="path-list">
              {plan.skipped.map((item, index) => (
                <li key={`${item.path ?? "unknown"}-${index}`}>
                  <span>
                    <strong>{item.reason}</strong>
                    <span>{item.path ?? "No concrete path"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={!canConfirm}>
            <Trash2 size={16} aria-hidden="true" />
            Delete selected sessions
          </button>
        </div>
      </section>
    </div>
  );
}

function hasConcretePath(item: DeletionPlan["items"][number]): boolean {
  return typeof item.path === "string" && item.path.trim().length > 0;
}
