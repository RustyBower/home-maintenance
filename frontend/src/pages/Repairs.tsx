import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Wrench } from "lucide-react";
import { CATEGORIES, CATEGORY_COLORS, type Asset } from "../api";

/* ── Types ─────────────────────────────────────────────── */

export interface Repair {
  id: number;
  title: string;
  description: string | null;
  diagnosis: string | null;
  resolution: string | null;
  category: string;
  asset_id: number | null;
  contractor_name: string | null;
  cost: number | null;
  reported_date: string;
  resolved_date: string | null;
  status: string;
  severity: string;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = "/api";

const SEVERITY_COLORS: Record<string, string> = {
  emergency: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#6b7280",
};

const STATUS_COLORS: Record<string, string> = {
  reported: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#22c55e",
};

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "emergency", label: "Emergency" },
] as const;

const STATUS_OPTIONS = [
  { value: "reported", label: "Reported" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
] as const;

/* ── API helpers ───────────────────────────────────────── */

async function fetchRepairs(params?: {
  category?: string;
  status?: string;
  severity?: string;
}): Promise<Repair[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  const res = await fetch(`${API_BASE}/repairs?${query}`);
  if (!res.ok) throw new Error("Failed to fetch repairs");
  return res.json();
}

async function createRepair(data: Record<string, unknown>): Promise<Repair> {
  const res = await fetch(`${API_BASE}/repairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create repair");
  return res.json();
}

async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch(`${API_BASE}/assets`);
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

/* ── Component ─────────────────────────────────────────── */

export default function Repairs() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "plumbing",
    severity: "medium",
    status: "reported",
    reported_date: new Date().toISOString().split("T")[0],
    asset_id: "",
    contractor_name: "",
    cost: "",
    notes: "",
  });

  const load = () => {
    fetchRepairs({
      status: filterStatus || undefined,
      category: filterCategory || undefined,
    }).then(setRepairs);
  };

  useEffect(() => {
    load();
    fetchAssets().then(setAssets);
  }, [filterStatus, filterCategory]);

  async function handleCreate() {
    await createRepair({
      title: form.title,
      description: form.description || undefined,
      category: form.category,
      severity: form.severity,
      status: form.status,
      reported_date: form.reported_date,
      asset_id: form.asset_id ? parseInt(form.asset_id) : undefined,
      contractor_name: form.contractor_name || undefined,
      cost: form.cost ? parseFloat(form.cost) : undefined,
      notes: form.notes || undefined,
    });
    setShowCreate(false);
    setForm({
      title: "",
      description: "",
      category: "plumbing",
      severity: "medium",
      status: "reported",
      reported_date: new Date().toISOString().split("T")[0],
      asset_id: "",
      contractor_name: "",
      cost: "",
      notes: "",
    });
    load();
  }

  // Sort: open repairs first (reported, in_progress), then resolved
  const sorted = [...repairs].sort((a, b) => {
    const statusOrder: Record<string, number> = { reported: 0, in_progress: 1, resolved: 2 };
    const sa = statusOrder[a.status] ?? 1;
    const sb = statusOrder[b.status] ?? 1;
    if (sa !== sb) return sa - sb;
    return b.reported_date.localeCompare(a.reported_date);
  });

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Repair Log</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Log Repair
        </button>
      </div>

      <div className="filters">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {sorted.length === 0 ? (
          <div className="empty">
            <Wrench size={24} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
            <div>No repairs logged yet</div>
          </div>
        ) : (
          sorted.map((r) => {
            const catLabel = CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category;
            return (
              <Link key={r.id} to={`/repairs/${r.id}`} className="task-item">
                <div className="task-info">
                  <span className="cat-dot" style={{ backgroundColor: CATEGORY_COLORS[r.category] }} />
                  <span className="task-name">{r.title}</span>
                </div>
                <div className="task-meta">
                  <span
                    className="badge badge-category"
                    style={{ backgroundColor: CATEGORY_COLORS[r.category] }}
                  >
                    {catLabel}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: SEVERITY_COLORS[r.severity] + "22",
                      color: SEVERITY_COLORS[r.severity],
                    }}
                  >
                    {r.severity}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: STATUS_COLORS[r.status] + "22",
                      color: STATUS_COLORS[r.status],
                    }}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                  {r.cost != null && (
                    <span className="badge" style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}>
                      ${Number(r.cost).toFixed(2)}
                    </span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {formatDate(r.reported_date)}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Log Repair</h3>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Kitchen faucet leak"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Reported Date</label>
                <input
                  type="date"
                  value={form.reported_date}
                  onChange={(e) => setForm((f) => ({ ...f, reported_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Asset (optional)</label>
                <select value={form.asset_id} onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}>
                  <option value="">None</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Contractor</label>
                <input
                  type="text"
                  value={form.contractor_name}
                  onChange={(e) => setForm((f) => ({ ...f, contractor_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.title || !form.reported_date}>
                Log Repair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
