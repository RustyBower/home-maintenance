import { useEffect, useState } from "react";
import { Plus, FileText, ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  fetchDocuments, createDocument, updateDocument, deleteDocument,
  fetchAssets, fetchTasks,
  DOC_TYPES, DOC_TYPE_COLORS, EXPIRY_STATUS_COLORS,
  type Document, type Asset, type Task,
} from "../api";

interface Repair {
  id: number;
  title: string;
}

const API_BASE = "/api";

async function fetchRepairsList(): Promise<Repair[]> {
  const res = await fetch(`${API_BASE}/repairs`);
  if (!res.ok) throw new Error("Failed to fetch repairs");
  return res.json();
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EXPIRY_LABELS: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  unknown: "No Expiry",
};

const emptyForm = {
  name: "",
  doc_type: "manual",
  url: "",
  asset_id: "",
  task_id: "",
  repair_id: "",
  expiry_date: "",
  notes: "",
};

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = () => {
    fetchDocuments({ doc_type: filterType || undefined }).then(setDocs);
  };

  useEffect(() => {
    load();
    fetchAssets().then(setAssets);
    fetchTasks().then(setTasks);
    fetchRepairsList().then(setRepairs);
  }, [filterType]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(doc: Document) {
    setEditingId(doc.id);
    setForm({
      name: doc.name,
      doc_type: doc.doc_type,
      url: doc.url,
      asset_id: doc.asset_id?.toString() || "",
      task_id: doc.task_id?.toString() || "",
      repair_id: doc.repair_id?.toString() || "",
      expiry_date: doc.expiry_date || "",
      notes: doc.notes || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    const payload: Record<string, unknown> = {
      name: form.name,
      doc_type: form.doc_type,
      url: form.url,
      asset_id: form.asset_id ? parseInt(form.asset_id) : null,
      task_id: form.task_id ? parseInt(form.task_id) : null,
      repair_id: form.repair_id ? parseInt(form.repair_id) : null,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
    };
    if (editingId) {
      await updateDocument(editingId, payload as Partial<Document>);
    } else {
      await createDocument(payload as Parameters<typeof createDocument>[0]);
    }
    setShowModal(false);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
    load();
  }

  function linkedEntity(doc: Document): string | null {
    if (doc.asset_id) {
      const a = assets.find((x) => x.id === doc.asset_id);
      return a ? `Asset: ${a.name}` : "Asset #" + doc.asset_id;
    }
    if (doc.task_id) {
      const t = tasks.find((x) => x.id === doc.task_id);
      return t ? `Task: ${t.name}` : "Task #" + doc.task_id;
    }
    if (doc.repair_id) {
      const r = repairs.find((x) => x.id === doc.repair_id);
      return r ? `Repair: ${r.title}` : "Repair #" + doc.repair_id;
    }
    return null;
  }

  // Sort: expired/expiring first, then by name
  const sorted = [...docs].sort((a, b) => {
    const order: Record<string, number> = { expired: 0, expiring_soon: 1, active: 2, unknown: 3 };
    const oa = order[a.expiry_status] ?? 3;
    const ob = order[b.expiry_status] ?? 3;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="page-header">
        <h1>Documents</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Document
        </button>
      </div>

      <div className="filters">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {sorted.length === 0 ? (
          <div className="empty">
            <FileText size={24} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
            <div>No documents yet</div>
          </div>
        ) : (
          sorted.map((doc) => {
            const typeLabel = DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ?? doc.doc_type;
            const linked = linkedEntity(doc);
            return (
              <div key={doc.id} className="task-item" style={{ cursor: "default" }}>
                <div className="task-info">
                  <span
                    className="cat-dot"
                    style={{ backgroundColor: DOC_TYPE_COLORS[doc.doc_type] }}
                  />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="task-name"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doc.name} <ExternalLink size={12} style={{ verticalAlign: "middle" }} />
                  </a>
                </div>
                <div className="task-meta">
                  <span
                    className="badge badge-category"
                    style={{ backgroundColor: DOC_TYPE_COLORS[doc.doc_type] }}
                  >
                    {typeLabel}
                  </span>
                  {linked && (
                    <span
                      className="badge"
                      style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}
                    >
                      {linked}
                    </span>
                  )}
                  <span
                    className="badge"
                    style={{
                      backgroundColor: EXPIRY_STATUS_COLORS[doc.expiry_status] + "22",
                      color: EXPIRY_STATUS_COLORS[doc.expiry_status],
                    }}
                  >
                    {EXPIRY_LABELS[doc.expiry_status]}
                  </span>
                  {doc.expiry_date && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatDate(doc.expiry_date)}
                    </span>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "0.25rem 0.5rem" }}
                    onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: "0.25rem 0.5rem" }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{editingId ? "Edit Document" : "Add Document"}</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder='e.g. "Carrier AC Manual"'
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Document Type</label>
                <select value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))}>
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
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
                <label>Task (optional)</label>
                <select value={form.task_id} onChange={(e) => setForm((f) => ({ ...f, task_id: e.target.value }))}>
                  <option value="">None</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Repair (optional)</label>
              <select value={form.repair_id} onChange={(e) => setForm((f) => ({ ...f, repair_id: e.target.value }))}>
                <option value="">None</option>
                {repairs.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.url}>
                {editingId ? "Save Changes" : "Add Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
