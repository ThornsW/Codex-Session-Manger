import { Archive, Folder, Layers, TriangleAlert } from "lucide-react";
import type { GroupKey, SessionGroup } from "../sessionFilters";
import { formatBytes } from "../sessionFilters";

interface Props {
  groups: SessionGroup[];
  selectedGroup: GroupKey;
  onSelectGroup: (group: GroupKey) => void;
}

export function ProjectSidebar({ groups, selectedGroup, onSelectGroup }: Props) {
  return (
    <aside className="sidebar" aria-label="项目分组">
      <div className="panel-title">项目</div>
      <div className="group-list">
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            className={group.key === selectedGroup ? "group-row selected" : "group-row"}
            onClick={() => onSelectGroup(group.key)}
            title={group.label}
          >
            {iconForGroup(group.key)}
            <span className="group-label">{group.label}</span>
            <span className="group-meta">
              {group.count} / {formatBytes(group.sizeBytes)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function iconForGroup(groupKey: GroupKey) {
  if (groupKey === "all") return <Layers size={16} aria-hidden="true" />;
  if (groupKey === "archived") return <Archive size={16} aria-hidden="true" />;
  if (groupKey === "abnormal") return <TriangleAlert size={16} aria-hidden="true" />;
  return <Folder size={16} aria-hidden="true" />;
}
