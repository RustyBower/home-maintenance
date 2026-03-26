import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Plus, Shield, ShieldAlert, ShieldOff, MapPin } from "lucide-react";
import {
  fetchAssets, createAsset,
  CATEGORIES, CATEGORY_COLORS, LOCATIONS,
  type Asset,
} from "../api";

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [category, setCategory] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "appliances", manufacturer: "", model_number: "",
    serial_number: "", install_date: "", warranty_expires: "",
    expected_lifespan_years: "", purchase_price: "", manual_url: "",
    notes: "", location: "",
  });

  const load = () => {
    fetchAssets(category ? { category } : undefined).then(setAssets);
  };
  useEffect(() => { load(); }, [category]);

  async function handleAdd() {
    if (!form.name) return;
    await createAsset({
      name: form.name,
      category: form.category,
      manufacturer: form.manufacturer || undefined,
      model_number: form.model_number || undefined,
      serial_number: form.serial_number || undefined,
      install_date: form.install_date || undefined,
      warranty_expires: form.warranty_expires || undefined,
      expected_lifespan_years: form.expected_lifespan_years ? parseInt(form.expected_lifespan_years) : undefined,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
      manual_url: form.manual_url || undefined,
      notes: form.notes || undefined,
      location: form.location || undefined,
    });
    setShowAdd(false);
    setForm({
      name: "", category: "appliances", manufacturer: "", model_number: "",
      serial_number: "", install_date: "", warranty_expires: "",
      expected_lifespan_years: "", purchase_price: "", manual_url: "",
      notes: "", location: "",
    });
    load();
  }

  function warrantyBadge(status: string) {
    if (status === "active") return <span className="badge badge-ok"><Shield size={11} /> Active</span>;
    if (status === "expired") return <span className="badge badge-overdue"><ShieldOff size={11} /> Expired</span>;
    return <span className="badge" style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}><ShieldAlert size={11} /> Unknown</span>;
  }

  function lifespanStatus(asset: Asset): "ok" | "warning" | "danger" | null {
    if (!asset.install_date || !asset.expected_lifespan_years || asset.age_years == null) return null;
    const pct = asset.age_years / asset.expected_lifespan_years;
    if (pct >= 1) return "danger";
    if (pct >= 0.8) return "warning";
    return "ok";
  }

  function lifespanBorder(status: "ok" | "warning" | "danger" | null): string {
    if (status === "danger") return "var(--danger)";
    if (status === "warning") return "var(--warning)";
    return "var(--border)";
  }

  return (
    <div>
      <div className="page-header">
        <h1><Box size={24} style={{ verticalAlign: "middle" }} /> Asset Registry</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Asset</button>
      </div>

      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
          {assets.length} asset{assets.length !== 1 && "s"}
        </span>
      </div>

      {assets.length === 0 ? (
        <div className="card"><div className="empty">No assets registered yet.</div></div>
      ) : (
        <div className="grid-2">
          {assets.map((a) => {
            const ls = lifespanStatus(a);
            const catLabel = CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category;
            return (
              <Link key={a.id} to={`/assets/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="card" style={{ borderColor: lifespanBorder(ls), cursor: "pointer", transition: "border-color 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <div style={{ fontSize: "1rem", fontWeight: 600 }}>{a.name}</div>
                      {a.manufacturer && (
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                          {a.manufacturer}{a.model_number ? ` - ${a.model_number}` : ""}
                        </div>
                      )}
                    </div>
                    <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[a.category] }}>{catLabel}</span>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    {warrantyBadge(a.warranty_status)}
                    {a.age_years != null && (
                      <span className="badge" style={{
                        background: ls === "danger" ? "rgba(239,68,68,0.15)" : ls === "warning" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                        color: ls === "danger" ? "var(--danger)" : ls === "warning" ? "var(--warning)" : "var(--accent)",
                      }}>
                        {a.age_years} yr{a.age_years !== 1 ? "s" : ""} old
                      </span>
                    )}
                    {a.location && (
                      <span className="badge" style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}>
                        <MapPin size={11} /> {a.location}
                      </span>
                    )}
                  </div>

                  {a.expected_lifespan_years && a.age_years != null && (
                    <div style={{ marginTop: "0.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.125rem" }}>
                        <span>Lifespan</span>
                        <span>{a.age_years} / {a.expected_lifespan_years} yrs</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(100, (a.age_years / a.expected_lifespan_years) * 100)}%`,
                          height: "100%",
                          borderRadius: 2,
                          background: ls === "danger" ? "var(--danger)" : ls === "warning" ? "var(--warning)" : "var(--accent)",
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>Add Asset</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Carrier AC Unit" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
                <select value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}>
                  <option value="">Select...</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Manufacturer</label>
                <input type="text" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Model Number</label>
                <input type="text" value={form.model_number} onChange={(e) => setForm((f) => ({ ...f, model_number: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Serial Number</label>
              <input type="text" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Install Date</label>
                <input type="date" value={form.install_date} onChange={(e) => setForm((f) => ({ ...f, install_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Warranty Expires</label>
                <input type="date" value={form.warranty_expires} onChange={(e) => setForm((f) => ({ ...f, warranty_expires: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Expected Lifespan (years)</label>
                <input type="number" value={form.expected_lifespan_years} onChange={(e) => setForm((f) => ({ ...f, expected_lifespan_years: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Purchase Price ($)</label>
                <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Manual URL</label>
              <input type="url" value={form.manual_url} onChange={(e) => setForm((f) => ({ ...f, manual_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add Asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
