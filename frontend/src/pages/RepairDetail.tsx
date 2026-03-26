import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, Play, CheckCircle, Link as LinkIcon,
} from "lucide-react";
import { CATEGORIES, CATEGORY_COLORS, type Asset } from "../api";
import { format } from "date-fns";

/* ── Types (shared with Repairs.tsx) ───────────────────── */

interface Repair {
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

async function fetchRepair(id: number): Promise<Repair> {
  const res = await fetch(`${API_BASE}/repairs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch repair");
  return res.json();
}

async function updateRepair(id: number, data: Record<string, unknown>): Promise<Repair> {
  const res = await fetch(`${API_BASE}/repairs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update repair");
  return res.json();
}

async function deleteRepair(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/repairs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete repair");
}

async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch(`${API_BASE}/assets`);
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

async function fetchAsset(id: number): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch asset");
  return res.json();
}

/* ── Component ─────────────────────────────────────────── */

export default function RepairDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [repair, setRepair] = useState<Repair | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    diagnosis: "",
    resolution: "",
    category: "",
    severity: "",
    status: "",
    reported_date: "",
    resolved_date: "",
    asset_id: "",
    contractor_name: "",
    cost: "",
    photo_url: "",
    notes: "",
  });

  const load = () => {
    if (!id) return;
    fetchRepair(Number(id)).then((r) => {
      setRepair(r);
      if (r.asset_id) fetchAsset(r.asset_id).then(setAsset).catch(() => setAsset(null));
      else setAsset(null);
    });
  };

  useEffect(() => {
    load();
    fetchAssets().then(setAssets);
  }, [id]);

  function openEdit() {
    if (!repair) return;
    setEditForm({
      title: repair.title,
      description: repair.description || "",
      diagnosis: repair.diagnosis || "",
      resolution: repair.resolution || "",
      category: repair.category,
      severity: repair.severity,
      status: repair.status,
      reported_date: repair.reported_date,
      resolved_date: repair.resolved_date || "",
      asset_id: repair.asset_id?.toString() || "",
      contractor_name: repair.contractor_name || "",
      cost: repair.cost?.toString() || "",
      photo_url: repair.photo_url || "",
      notes: repair.notes || "",
    });
    setShowEdit(true);
  }

  async function handleEdit() {
    if (!repair) return;
    await updateRepair(repair.id, {
      title: editForm.title,
      description: editForm.description || undefined,
      diagnosis: editForm.diagnosis || undefined,
      resolution: editForm.resolution || undefined,
      category: editForm.category,
      severity: editForm.severity,
      status: editForm.status,
      reported_date: editForm.reported_date,
      resolved_date: editForm.resolved_date || undefined,
      asset_id: editForm.asset_id ? parseInt(editForm.asset_id) : null,
      contractor_name: editForm.contractor_name || undefined,
      cost: editForm.cost ? parseFloat(editForm.cost) : undefined,
      photo_url: editForm.photo_url || undefined,
      notes: editForm.notes || undefined,
    });
    setShowEdit(false);
    load();
  }

  async function handleDelete() {
    if (!repair || !confirm("Delete this repair log entry?")) return;
    await deleteRepair(repair.id);
    navigate("/repairs");
  }

  async function handleStatusChange(newStatus: string) {
    if (!repair) return;
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "resolved" && !repair.resolved_date) {
      updates.resolved_date = new Date().toISOString().split("T")[0];
    }
    await updateRepair(repair.id, updates);
    load();
  }

  if (!repair) return <div className="empty">Loading...</div>;

  const catLabel = CATEGORIES.find((c) => c.value === repair.category)?.label ?? repair.category;

  const statusSteps = [
    { key: "reported", label: "Reported", date: repair.reported_date },
    { key: "in_progress", label: "In Progress", date: null },
    { key: "resolved", label: "Resolved", date: repair.resolved_date },
  ];
  const currentStepIndex = statusSteps.findIndex((s) => s.key === repair.status);

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              {repair.title}
            </h1>
            {repair.contractor_name && (
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                Contractor: {repair.contractor_name}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" onClick={openEdit}><Pencil size={16} /> Edit</button>
            <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[repair.category] }}>
            {catLabel}
          </span>
          <span
            className="badge"
            style={{
              backgroundColor: SEVERITY_COLORS[repair.severity] + "22",
              color: SEVERITY_COLORS[repair.severity],
            }}
          >
            {repair.severity}
          </span>
          <span
            className="badge"
            style={{
              backgroundColor: STATUS_COLORS[repair.status] + "22",
              color: STATUS_COLORS[repair.status],
            }}
          >
            {repair.status.replace("_", " ")}
          </span>
          {repair.cost != null && (
            <span className="badge" style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}>
              ${Number(repair.cost).toFixed(2)}
            </span>
          )}
        </div>

        {/* Status timeline */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", padding: "0.75rem", background: "var(--bg)", borderRadius: 6 }}>
          {statusSteps.map((step, i) => {
            const isComplete = i <= currentStepIndex;
            const color = isComplete ? STATUS_COLORS[step.key] : "var(--border)";
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", color: "white", fontWeight: 600, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: "0.8125rem" }}>
                  <div style={{ color: isComplete ? "var(--text)" : "var(--text-muted)" }}>{step.label}</div>
                  {step.date && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {format(new Date(step.date + "T00:00:00"), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
                {i < statusSteps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, background: i < currentStepIndex ? STATUS_COLORS[statusSteps[i + 1].key] : "var(--border)",
                    marginLeft: "0.25rem",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Quick status buttons */}
        {repair.status !== "resolved" && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            {repair.status === "reported" && (
              <button className="btn" style={{ background: "#f59e0b", color: "white" }} onClick={() => handleStatusChange("in_progress")}>
                <Play size={16} /> Start Repair
              </button>
            )}
            <button className="btn btn-success" onClick={() => handleStatusChange("resolved")}>
              <CheckCircle size={16} /> Mark Resolved
            </button>
          </div>
        )}

        {/* Details grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", fontSize: "0.875rem" }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Reported</div>
            <div>{format(new Date(repair.reported_date + "T00:00:00"), "MMMM d, yyyy")}</div>
          </div>
          {repair.resolved_date && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Resolved</div>
              <div>{format(new Date(repair.resolved_date + "T00:00:00"), "MMMM d, yyyy")}</div>
            </div>
          )}
          {repair.cost != null && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Cost</div>
              <div>${Number(repair.cost).toFixed(2)}</div>
            </div>
          )}
          {repair.contractor_name && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Contractor</div>
              <div>{repair.contractor_name}</div>
            </div>
          )}
        </div>

        {/* Asset link */}
        {asset && (
          <div style={{ marginTop: "0.75rem" }}>
            <Link to={`/assets/${asset.id}`} style={{ color: "var(--accent)", fontSize: "0.875rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              <LinkIcon size={14} /> {asset.name}
            </Link>
          </div>
        )}

        {/* Photo */}
        {repair.photo_url && (
          <div style={{ marginTop: "0.75rem" }}>
            <img src={repair.photo_url} alt="Repair photo" style={{ maxWidth: "100%", borderRadius: 6, maxHeight: 300, objectFit: "cover" }} />
          </div>
        )}

        {/* Description / Diagnosis / Resolution */}
        {repair.description && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Description</div>
            <div style={{ padding: "0.75rem", background: "var(--bg)", borderRadius: 6, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
              {repair.description}
            </div>
          </div>
        )}
        {repair.diagnosis && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Diagnosis</div>
            <div style={{ padding: "0.75rem", background: "var(--bg)", borderRadius: 6, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
              {repair.diagnosis}
            </div>
          </div>
        )}
        {repair.resolution && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Resolution</div>
            <div style={{ padding: "0.75rem", background: "var(--bg)", borderRadius: 6, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
              {repair.resolution}
            </div>
          </div>
        )}
        {repair.notes && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Notes</div>
            <div style={{ padding: "0.75rem", background: "var(--bg)", borderRadius: 6, fontSize: "0.875rem", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
              {repair.notes}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Edit Repair</h3>
            <div className="form-group">
              <label>Title</label>
              <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Diagnosis</label>
              <textarea value={editForm.diagnosis} onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Resolution</label>
              <textarea value={editForm.resolution} onChange={(e) => setEditForm((f) => ({ ...f, resolution: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select value={editForm.severity} onChange={(e) => setEditForm((f) => ({ ...f, severity: e.target.value }))}>
                  {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Asset</label>
                <select value={editForm.asset_id} onChange={(e) => setEditForm((f) => ({ ...f, asset_id: e.target.value }))}>
                  <option value="">None</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Reported Date</label>
                <input type="date" value={editForm.reported_date} onChange={(e) => setEditForm((f) => ({ ...f, reported_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Resolved Date</label>
                <input type="date" value={editForm.resolved_date} onChange={(e) => setEditForm((f) => ({ ...f, resolved_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Contractor</label>
                <input type="text" value={editForm.contractor_name} onChange={(e) => setEditForm((f) => ({ ...f, contractor_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Cost ($)</label>
                <input type="number" step="0.01" value={editForm.cost} onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Photo URL</label>
              <input type="url" value={editForm.photo_url} onChange={(e) => setEditForm((f) => ({ ...f, photo_url: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
