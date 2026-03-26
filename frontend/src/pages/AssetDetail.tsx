import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, ExternalLink, Shield, ShieldOff, ShieldAlert, MapPin, Plus } from "lucide-react";
import {
  fetchAsset, updateAsset, deleteAsset,
  fetchDocuments, createDocument,
  CATEGORIES, CATEGORY_COLORS, LOCATIONS, PRIORITY_COLORS,
  DOC_TYPES, DOC_TYPE_COLORS, EXPIRY_STATUS_COLORS,
  type AssetWithTasks, type Document,
} from "../api";
import { format } from "date-fns";

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<AssetWithTasks | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    name: "", doc_type: "manual", url: "", expiry_date: "", notes: "",
  });
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", category: "", manufacturer: "", model_number: "",
    serial_number: "", install_date: "", warranty_expires: "",
    expected_lifespan_years: "", purchase_price: "", manual_url: "",
    notes: "", location: "",
  });

  const load = () => {
    if (id) {
      fetchAsset(Number(id)).then(setAsset);
      fetchDocuments({ asset_id: Number(id) }).then(setDocs);
    }
  };
  useEffect(load, [id]);

  function openEdit() {
    if (!asset) return;
    setEditForm({
      name: asset.name,
      category: asset.category,
      manufacturer: asset.manufacturer || "",
      model_number: asset.model_number || "",
      serial_number: asset.serial_number || "",
      install_date: asset.install_date || "",
      warranty_expires: asset.warranty_expires || "",
      expected_lifespan_years: asset.expected_lifespan_years?.toString() || "",
      purchase_price: asset.purchase_price?.toString() || "",
      manual_url: asset.manual_url || "",
      notes: asset.notes || "",
      location: asset.location || "",
    });
    setShowEdit(true);
  }

  async function handleEdit() {
    if (!asset) return;
    await updateAsset(asset.id, {
      name: editForm.name,
      category: editForm.category,
      manufacturer: editForm.manufacturer || undefined,
      model_number: editForm.model_number || undefined,
      serial_number: editForm.serial_number || undefined,
      install_date: editForm.install_date || undefined,
      warranty_expires: editForm.warranty_expires || undefined,
      expected_lifespan_years: editForm.expected_lifespan_years ? parseInt(editForm.expected_lifespan_years) : undefined,
      purchase_price: editForm.purchase_price ? parseFloat(editForm.purchase_price) : undefined,
      manual_url: editForm.manual_url || undefined,
      notes: editForm.notes || undefined,
      location: editForm.location || undefined,
    } as Partial<AssetWithTasks>);
    setShowEdit(false);
    load();
  }

  async function handleAddDoc() {
    if (!asset) return;
    await createDocument({
      name: docForm.name,
      doc_type: docForm.doc_type,
      url: docForm.url,
      asset_id: asset.id,
      expiry_date: docForm.expiry_date || undefined,
      notes: docForm.notes || undefined,
    });
    setShowAddDoc(false);
    setDocForm({ name: "", doc_type: "manual", url: "", expiry_date: "", notes: "" });
    load();
  }

  async function handleDelete() {
    if (!asset || !confirm("Delete this asset? Tasks linked to it will be unlinked.")) return;
    await deleteAsset(asset.id);
    navigate("/assets");
  }

  if (!asset) return <div className="empty">Loading...</div>;

  const catLabel = CATEGORIES.find((c) => c.value === asset.category)?.label ?? asset.category;

  function warrantyBadge(status: string) {
    if (status === "active") return <span className="badge badge-ok"><Shield size={12} /> Warranty Active</span>;
    if (status === "expired") return <span className="badge badge-overdue"><ShieldOff size={12} /> Warranty Expired</span>;
    return <span className="badge" style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}><ShieldAlert size={12} /> Warranty Unknown</span>;
  }

  const lifespanPct = asset.age_years != null && asset.expected_lifespan_years
    ? Math.min(100, (asset.age_years / asset.expected_lifespan_years) * 100)
    : null;
  const lifespanColor = lifespanPct != null
    ? lifespanPct >= 100 ? "var(--danger)" : lifespanPct >= 80 ? "var(--warning)" : "var(--accent)"
    : "var(--accent)";

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.25rem" }}>{asset.name}</h1>
            {asset.manufacturer && (
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                {asset.manufacturer}{asset.model_number ? ` - ${asset.model_number}` : ""}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" onClick={openEdit}><Pencil size={16} /> Edit</button>
            <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[asset.category] }}>{catLabel}</span>
          {warrantyBadge(asset.warranty_status)}
          {asset.location && (
            <span className="badge" style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}>
              <MapPin size={11} /> {asset.location}
            </span>
          )}
        </div>

        {/* Age / Lifespan bar */}
        {asset.expected_lifespan_years && asset.age_years != null && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              <span>Age / Expected Lifespan</span>
              <span>{asset.age_years} / {asset.expected_lifespan_years} years</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
              <div style={{
                width: `${lifespanPct}%`,
                height: "100%",
                borderRadius: 4,
                background: lifespanColor,
                transition: "width 0.3s",
              }} />
            </div>
            {asset.replacement_estimate && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Estimated replacement: {format(new Date(asset.replacement_estimate + "T00:00:00"), "MMMM yyyy")}
              </div>
            )}
          </div>
        )}

        {/* Details grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", fontSize: "0.875rem" }}>
          {asset.serial_number && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Serial Number</div>
              <div>{asset.serial_number}</div>
            </div>
          )}
          {asset.install_date && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Installed</div>
              <div>{format(new Date(asset.install_date + "T00:00:00"), "MMMM d, yyyy")}</div>
            </div>
          )}
          {asset.warranty_expires && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Warranty Expires</div>
              <div>{format(new Date(asset.warranty_expires + "T00:00:00"), "MMMM d, yyyy")}</div>
            </div>
          )}
          {asset.purchase_price != null && (
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Purchase Price</div>
              <div>${Number(asset.purchase_price).toFixed(2)}</div>
            </div>
          )}
        </div>

        {asset.manual_url && (
          <div style={{ marginTop: "0.75rem" }}>
            <a href={asset.manual_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: "0.875rem", textDecoration: "none" }}>
              <ExternalLink size={14} style={{ verticalAlign: "middle" }} /> View Manual
            </a>
          </div>
        )}

        {asset.notes && (
          <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--bg)", borderRadius: 6, fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {asset.notes}
          </div>
        )}
      </div>

      {/* Linked Tasks */}
      <div className="card">
        <h3>Linked Tasks</h3>
        {asset.tasks.length === 0 ? (
          <div className="empty">No tasks linked to this asset. Edit a task to link it.</div>
        ) : (
          asset.tasks.map((t) => {
            const today = new Date().toISOString().split("T")[0];
            const isOverdue = t.next_due && t.next_due < today;
            return (
              <Link key={t.id} to={`/tasks/${t.id}`} className="task-item">
                <div className="task-info">
                  <span className="cat-dot" style={{ backgroundColor: CATEGORY_COLORS[t.category] }} />
                  <span className="task-name">{t.name}</span>
                </div>
                <div className="task-meta">
                  <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[t.priority] + "22", color: PRIORITY_COLORS[t.priority] }}>
                    {t.priority.toUpperCase()}
                  </span>
                  {t.next_due && (
                    <span className={`badge ${isOverdue ? "badge-overdue" : "badge-upcoming"}`}>
                      {format(new Date(t.next_due + "T00:00:00"), "MMM d")}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Linked Documents */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>Documents</h3>
          <button className="btn btn-primary" style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }} onClick={() => setShowAddDoc(true)}>
            <Plus size={14} /> Add Document
          </button>
        </div>
        {docs.length === 0 ? (
          <div className="empty">No documents linked to this asset.</div>
        ) : (
          docs.map((doc) => {
            const typeLabel = DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ?? doc.doc_type;
            const expiryLabel: Record<string, string> = { active: "Active", expiring_soon: "Expiring Soon", expired: "Expired", unknown: "No Expiry" };
            return (
              <div key={doc.id} className="task-item" style={{ cursor: "default" }}>
                <div className="task-info">
                  <span className="cat-dot" style={{ backgroundColor: DOC_TYPE_COLORS[doc.doc_type] }} />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="task-name"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                  >
                    {doc.name} <ExternalLink size={12} style={{ verticalAlign: "middle" }} />
                  </a>
                </div>
                <div className="task-meta">
                  <span className="badge badge-category" style={{ backgroundColor: DOC_TYPE_COLORS[doc.doc_type] }}>
                    {typeLabel}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: EXPIRY_STATUS_COLORS[doc.expiry_status] + "22",
                      color: EXPIRY_STATUS_COLORS[doc.expiry_status],
                    }}
                  >
                    {expiryLabel[doc.expiry_status]}
                  </span>
                  {doc.expiry_date && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {format(new Date(doc.expiry_date + "T00:00:00"), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Document Modal */}
      {showAddDoc && (
        <div className="modal-overlay" onClick={() => setShowAddDoc(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Add Document for {asset.name}</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" placeholder='e.g. "Carrier AC Manual"' value={docForm.name} onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>URL</label>
              <input type="url" placeholder="https://..." value={docForm.url} onChange={(e) => setDocForm((f) => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Document Type</label>
                <select value={docForm.doc_type} onChange={(e) => setDocForm((f) => ({ ...f, doc_type: e.target.value }))}>
                  {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm((f) => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={docForm.notes} onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddDoc(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDoc} disabled={!docForm.name || !docForm.url}>Add Document</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Edit Asset</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
                <select value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}>
                  <option value="">Select...</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Manufacturer</label>
                <input type="text" value={editForm.manufacturer} onChange={(e) => setEditForm((f) => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Model Number</label>
                <input type="text" value={editForm.model_number} onChange={(e) => setEditForm((f) => ({ ...f, model_number: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Serial Number</label>
              <input type="text" value={editForm.serial_number} onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Install Date</label>
                <input type="date" value={editForm.install_date} onChange={(e) => setEditForm((f) => ({ ...f, install_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Warranty Expires</label>
                <input type="date" value={editForm.warranty_expires} onChange={(e) => setEditForm((f) => ({ ...f, warranty_expires: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Expected Lifespan (years)</label>
                <input type="number" value={editForm.expected_lifespan_years} onChange={(e) => setEditForm((f) => ({ ...f, expected_lifespan_years: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Purchase Price ($)</label>
                <input type="number" step="0.01" value={editForm.purchase_price} onChange={(e) => setEditForm((f) => ({ ...f, purchase_price: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Manual URL</label>
              <input type="url" value={editForm.manual_url} onChange={(e) => setEditForm((f) => ({ ...f, manual_url: e.target.value }))} />
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
