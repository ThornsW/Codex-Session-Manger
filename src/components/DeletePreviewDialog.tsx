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
            <p className="eyebrow">删除预览</p>
            <h2 id="delete-preview-title">查看 {plan.items.length} 个计划项</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="关闭删除预览" disabled={busy}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="dialog-summary">
          <span>{plan.sessionIds.length} 个会话</span>
          <span>预计释放 {formatBytes(plan.freedBytes)}</span>
          <span>{plan.skipped.length} 个已跳过</span>
        </div>

        <div className="dialog-list">
          {plan.items.length === 0 ? (
            <p className="muted">没有找到可删除项。</p>
          ) : (
            <ul className="path-list">
              {plan.items.map((item, index) => (
                <li key={`${item.kind}-${item.path ?? index}`}>
                  <span>
                    <strong>{item.description}</strong>
                    <small>
                      {deletionKindLabel(item.kind)} / {formatBytes(item.sizeBytes)}
                    </small>
                    <span>{item.path ?? "无明确路径"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {plan.skipped.length > 0 ? (
          <div className="dialog-list skipped">
            <h3>已跳过</h3>
            <ul className="path-list">
              {plan.skipped.map((item, index) => (
                <li key={`${item.path ?? "unknown"}-${index}`}>
                  <span>
                    <strong>{item.reason}</strong>
                    <span>{item.path ?? "无明确路径"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={!canConfirm}>
            <Trash2 size={16} aria-hidden="true" />
            删除选中的会话
          </button>
        </div>
      </section>
    </div>
  );
}

function hasConcretePath(item: DeletionPlan["items"][number]): boolean {
  return typeof item.path === "string" && item.path.trim().length > 0;
}

function deletionKindLabel(kind: DeletionPlan["items"][number]["kind"]): string {
  if (kind === "session_file") return "会话文件";
  if (kind === "index_record") return "索引记录";
  if (kind === "cache_file") return "缓存文件";
  return "空目录";
}
