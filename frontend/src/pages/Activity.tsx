import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  CheckCircle,
  AlarmClockOff,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { fetchActivity, type Activity as ActivityItem } from "../api";
import { formatDistanceToNow } from "date-fns";

const ACTION_ICONS: Record<string, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  completed: CheckCircle,
  snoozed: AlarmClockOff,
  deleted: Trash2,
  status_changed: ArrowRight,
};

const ACTION_COLORS: Record<string, string> = {
  created: "#22c55e",
  completed: "#22c55e",
  updated: "#3b82f6",
  snoozed: "#f59e0b",
  deleted: "#ef4444",
  status_changed: "#3b82f6",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  completed: "Completed",
  snoozed: "Snoozed",
  deleted: "Deleted",
  status_changed: "Status changed",
};

const ENTITY_ROUTES: Record<string, string> = {
  task: "/tasks",
  asset: "/assets",
  repair: "/repairs",
  contractor: "/contractors",
};

const ENTITY_LABELS: Record<string, string> = {
  task: "Task",
  asset: "Asset",
  repair: "Repair",
  contractor: "Contractor",
  document: "Document",
  supply: "Supply",
};

function ActivityEntry({ item, compact }: { item: ActivityItem; compact?: boolean }) {
  const Icon = ACTION_ICONS[item.action] || ArrowRight;
  const color = ACTION_COLORS[item.action] || "#6b7280";
  const route = ENTITY_ROUTES[item.entity_type];
  const isDeleted = item.action === "deleted";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: compact ? "0.5rem 0" : "0.75rem 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? "0.8125rem" : "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
          <span style={{ color: ACTION_COLORS[item.action], fontWeight: 500 }}>
            {ACTION_LABELS[item.action]}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{ENTITY_LABELS[item.entity_type]}:</span>
          {route && !isDeleted ? (
            <Link
              to={`${route}/${item.entity_id}`}
              style={{ color: "var(--text)", textDecoration: "none", fontWeight: 500 }}
            >
              {item.entity_name}
            </Link>
          ) : (
            <span style={{ fontWeight: 500 }}>{item.entity_name}</span>
          )}
        </div>
        {item.details && (
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
            {item.details}
          </div>
        )}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

export { ActivityEntry };

export default function Activity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [entityType, setEntityType] = useState("");

  useEffect(() => {
    fetchActivity({
      entity_type: entityType || undefined,
      limit: 50,
    }).then(setItems);
  }, [entityType]);

  return (
    <div>
      <div className="page-header">
        <h1>Activity Log</h1>
      </div>

      <div className="filters">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All types</option>
          <option value="task">Tasks</option>
          <option value="asset">Assets</option>
          <option value="repair">Repairs</option>
          <option value="contractor">Contractors</option>
          <option value="document">Documents</option>
          <option value="supply">Supplies</option>
        </select>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">No activity yet.</div>
        ) : (
          items.map((item) => <ActivityEntry key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
