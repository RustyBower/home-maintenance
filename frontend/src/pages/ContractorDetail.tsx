import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Phone, Mail, Globe, MapPin, Star, ExternalLink } from "lucide-react";
import {
  fetchContractor, updateContractor, deleteContractor,
  CATEGORIES, CATEGORY_COLORS,
  type ContractorWithHistory,
} from "../api";
import { format } from "date-fns";

export default function ContractorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contractor, setContractor] = useState<ContractorWithHistory | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", specialty: "", phone: "", email: "",
    website: "", address: "", notes: "", rating: "",
  });

  const load = () => { if (id) fetchContractor(Number(id)).then(setContractor); };
  useEffect(load, [id]);

  function openEdit() {
    if (!contractor) return;
    setEditForm({
      name: contractor.name,
      specialty: contractor.specialty,
      phone: contractor.phone || "",
      email: contractor.email || "",
      website: contractor.website || "",
      address: contractor.address || "",
      notes: contractor.notes || "",
      rating: contractor.rating?.toString() || "",
    });
    setShowEdit(true);
  }

  async function handleEdit() {
    if (!contractor) return;
    await updateContractor(contractor.id, {
      name: editForm.name,
      specialty: editForm.specialty,
      phone: editForm.phone || undefined,
      email: editForm.email || undefined,
      website: editForm.website || undefined,
      address: editForm.address || undefined,
      notes: editForm.notes || undefined,
      rating: editForm.rating ? parseInt(editForm.rating) : undefined,
    } as Partial<ContractorWithHistory>);
    setShowEdit(false);
    load();
  }

  async function handleDelete() {
    if (!contractor || !confirm("Delete this contractor? Linked completions will be unlinked.")) return;
    await deleteContractor(contractor.id);
    navigate("/contractors");
  }

  if (!contractor) return <div className="empty">Loading...</div>;

  const catLabel = CATEGORIES.find((c) => c.value === contractor.specialty)?.label ?? contractor.specialty;

  function renderRating(rating: number | null) {
    if (rating == null) return <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No rating</span>;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={16}
          fill={i <= rating ? "#f59e0b" : "none"}
          color={i <= rating ? "#f59e0b" : "var(--text-muted)"}
        />
      );
    }
    return <span style={{ display: "inline-flex", gap: "2px", alignItems: "center" }}>{stars}</span>;
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.25rem" }}>{contractor.name}</h1>
            <div style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>{renderRating(contractor.rating)}</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" onClick={openEdit}><Pencil size={16} /> Edit</button>
            <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[contractor.specialty] }}>{catLabel}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {contractor.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Phone size={14} color="var(--text-muted)" />
              <a href={`tel:${contractor.phone}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{contractor.phone}</a>
            </div>
          )}
          {contractor.email && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Mail size={14} color="var(--text-muted)" />
              <a href={`mailto:${contractor.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{contractor.email}</a>
            </div>
          )}
          {contractor.website && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Globe size={14} color="var(--text-muted)" />
              <a href={contractor.website} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                {contractor.website.replace(/^https?:\/\//, "")} <ExternalLink size={11} style={{ verticalAlign: "middle" }} />
              </a>
            </div>
          )}
          {contractor.address && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <MapPin size={14} color="var(--text-muted)" />
              <span>{contractor.address}</span>
            </div>
          )}
        </div>

        {contractor.notes && (
          <div style={{ padding: "0.75rem", background: "var(--bg)", borderRadius: 6, fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {contractor.notes}
          </div>
        )}

        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          <span>{contractor.jobs_completed} job{contractor.jobs_completed !== 1 && "s"} completed</span>
          {contractor.total_spent > 0 && <span>Total spent: ${contractor.total_spent.toFixed(2)}</span>}
        </div>
      </div>

      {/* Work History */}
      <div className="card">
        <h3>Work History</h3>
        {contractor.recent_work.length === 0 ? (
          <div className="empty">No work history yet. Complete a task and assign this contractor.</div>
        ) : (
          contractor.recent_work.map((w) => (
            <div key={w.id} className="completion-item" style={{ flexWrap: "wrap" }}>
              <Link to={`/tasks/${w.task_id}`} style={{ color: "var(--accent)", textDecoration: "none", fontSize: "0.875rem" }}>
                {w.task_name}
              </Link>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                {format(new Date(w.completed_at), "MMM d, yyyy")}
              </span>
              {w.cost != null && w.cost > 0 && (
                <span className="badge badge-ok">${Number(w.cost).toFixed(2)}</span>
              )}
              {w.notes && <span style={{ color: "var(--text-muted)", width: "100%", paddingLeft: "0", fontSize: "0.8125rem" }}>{w.notes}</span>}
            </div>
          ))
        )}
      </div>

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Edit Contractor</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Specialty</label>
                <select value={editForm.specialty} onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Rating (1-5)</label>
                <select value={editForm.rating} onChange={(e) => setEditForm((f) => ({ ...f, rating: e.target.value }))}>
                  <option value="">No rating</option>
                  {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} star{r !== 1 && "s"}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Website</label>
              <input type="url" value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
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
