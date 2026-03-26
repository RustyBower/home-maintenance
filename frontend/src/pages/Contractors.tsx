import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Plus, Phone, Mail, Star } from "lucide-react";
import {
  fetchContractors, createContractor,
  CATEGORIES, CATEGORY_COLORS,
  type Contractor,
} from "../api";

export default function Contractors() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", specialty: "plumbing", phone: "", email: "",
    website: "", address: "", notes: "", rating: "",
  });

  const load = () => {
    fetchContractors(specialty ? { specialty } : undefined).then(setContractors);
  };
  useEffect(() => { load(); }, [specialty]);

  async function handleAdd() {
    if (!form.name) return;
    await createContractor({
      name: form.name,
      specialty: form.specialty,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
      rating: form.rating ? parseInt(form.rating) : undefined,
    });
    setShowAdd(false);
    setForm({
      name: "", specialty: "plumbing", phone: "", email: "",
      website: "", address: "", notes: "", rating: "",
    });
    load();
  }

  function renderRating(rating: number | null) {
    if (rating == null) return <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>No rating</span>;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={14}
          fill={i <= rating ? "#f59e0b" : "none"}
          color={i <= rating ? "#f59e0b" : "var(--text-muted)"}
        />
      );
    }
    return <span style={{ display: "inline-flex", gap: "1px" }}>{stars}</span>;
  }

  return (
    <div>
      <div className="page-header">
        <h1><Users size={24} style={{ verticalAlign: "middle" }} /> Contractors</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Contractor</button>
      </div>

      <div className="filters">
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          <option value="">All Specialties</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
          {contractors.length} contractor{contractors.length !== 1 && "s"}
        </span>
      </div>

      {contractors.length === 0 ? (
        <div className="card"><div className="empty">No contractors added yet.</div></div>
      ) : (
        <div className="grid-2">
          {contractors.map((c) => {
            const catLabel = CATEGORIES.find((cat) => cat.value === c.specialty)?.label ?? c.specialty;
            return (
              <Link key={c.id} to={`/contractors/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <div style={{ fontSize: "1rem", fontWeight: 600 }}>{c.name}</div>
                      <div style={{ marginTop: "0.25rem" }}>{renderRating(c.rating)}</div>
                    </div>
                    <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[c.specialty] }}>{catLabel}</span>
                  </div>

                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    {c.phone && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Phone size={12} /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Mail size={12} /> {c.email}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8125rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {c.jobs_completed} job{c.jobs_completed !== 1 && "s"}
                    </span>
                    {c.total_spent > 0 && (
                      <span style={{ color: "var(--success)" }}>
                        ${c.total_spent.toFixed(2)} spent
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Add Contractor</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='e.g. "ABC Plumbing"' />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Specialty</label>
                <select value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Rating (1-5)</label>
                <select value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}>
                  <option value="">No rating</option>
                  {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} star{r !== 1 && "s"}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@example.com" />
              </div>
            </div>
            <div className="form-group">
              <label>Website</label>
              <input type="url" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add Contractor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
