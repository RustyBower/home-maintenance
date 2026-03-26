import { useEffect, useState } from "react";
import {
  DollarSign,
  Plus,
  Calendar,
  Edit2,
  Trash2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

// ── Inline interfaces & API helpers (avoid modifying shared api.ts) ──

const API_BASE = "/api";

const CATEGORIES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "exterior", label: "Exterior" },
  { value: "outdoor", label: "Outdoor" },
  { value: "appliances", label: "Appliances" },
  { value: "safety", label: "Safety" },
  { value: "hot_tub", label: "Hot Tub" },
  { value: "garage", label: "Garage" },
  { value: "pest", label: "Pest Control" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  hvac: "#3b82f6",
  plumbing: "#06b6d4",
  electrical: "#f59e0b",
  exterior: "#84cc16",
  outdoor: "#22c55e",
  appliances: "#8b5cf6",
  safety: "#ef4444",
  hot_tub: "#ec4899",
  garage: "#6b7280",
  pest: "#f97316",
  other: "#a3a3a3",
};

const EXPENSE_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
] as const;

export interface Expense {
  id: number;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  provider: string | null;
  start_date: string | null;
  renewal_date: string | null;
  auto_renew: boolean;
  notes: string | null;
  active: boolean;
  contractor_id: number | null;
  created_at: string;
  updated_at: string;
  monthly_cost: number;
}

interface Contractor {
  id: number;
  name: string;
  specialty: string;
}

interface CategoryBreakdown {
  category: string;
  monthly_total: number;
  annual_total: number;
  count: number;
}

interface UpcomingRenewal {
  id: number;
  name: string;
  renewal_date: string;
  amount: number;
  frequency: string;
  days_until: number;
}

interface ExpenseSummary {
  total_monthly: number;
  total_annual: number;
  active_count: number;
  by_category: CategoryBreakdown[];
  upcoming_renewals: UpcomingRenewal[];
}

async function fetchExpenses(params?: {
  category?: string;
  active?: boolean;
}): Promise<Expense[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.active !== undefined) query.set("active", String(params.active));
  const res = await fetch(`${API_BASE}/expenses?${query}`);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

async function fetchExpenseSummary(): Promise<ExpenseSummary> {
  const res = await fetch(`${API_BASE}/expenses/summary`);
  if (!res.ok) throw new Error("Failed to fetch expense summary");
  return res.json();
}

async function createExpense(data: Record<string, unknown>): Promise<Expense> {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create expense");
  return res.json();
}

async function updateExpense(
  id: number,
  data: Record<string, unknown>
): Promise<Expense> {
  const res = await fetch(`${API_BASE}/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update expense");
  return res.json();
}

async function deleteExpense(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/expenses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete expense");
}

async function fetchContractors(): Promise<Contractor[]> {
  const res = await fetch(`${API_BASE}/contractors`);
  if (!res.ok) throw new Error("Failed to fetch contractors");
  return res.json();
}

// ── Helpers ──

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function renewalStatus(
  renewalDate: string | null
): "ok" | "warning" | "overdue" | null {
  if (!renewalDate) return null;
  const diff = Math.ceil(
    (new Date(renewalDate + "T00:00:00").getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return "overdue";
  if (diff <= 30) return "warning";
  return "ok";
}

// ── Component ──

const emptyForm = {
  name: "",
  category: "other",
  amount: "",
  frequency: "monthly",
  provider: "",
  start_date: "",
  renewal_date: "",
  auto_renew: true,
  notes: "",
  active: true,
  contractor_id: "",
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("active");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = () => {
    const activeParam =
      activeFilter === "active"
        ? true
        : activeFilter === "inactive"
          ? false
          : undefined;
    fetchExpenses({
      category: category || undefined,
      active: activeParam,
    }).then(setExpenses);
    fetchExpenseSummary().then(setSummary);
  };

  useEffect(() => {
    load();
  }, [category, activeFilter]);

  useEffect(() => {
    fetchContractors().then(setContractors);
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      name: e.name,
      category: e.category,
      amount: String(e.amount),
      frequency: e.frequency,
      provider: e.provider || "",
      start_date: e.start_date || "",
      renewal_date: e.renewal_date || "",
      auto_renew: e.auto_renew,
      notes: e.notes || "",
      active: e.active,
      contractor_id: e.contractor_id ? String(e.contractor_id) : "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.amount) return;
    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      provider: form.provider || null,
      start_date: form.start_date || null,
      renewal_date: form.renewal_date || null,
      auto_renew: form.auto_renew,
      notes: form.notes || null,
      active: form.active,
      contractor_id: form.contractor_id
        ? parseInt(form.contractor_id)
        : null,
    };
    if (editingId) {
      await updateExpense(editingId, payload);
    } else {
      await createExpense(payload);
    }
    setShowModal(false);
    load();
  }

  async function handleDelete(id: number) {
    await deleteExpense(id);
    setConfirmDelete(null);
    load();
  }

  async function toggleActive(e: Expense) {
    await updateExpense(e.id, { active: !e.active });
    load();
  }

  const catLabel = (val: string) =>
    CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const freqLabel = (val: string) =>
    EXPENSE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;

  return (
    <div>
      <div className="page-header">
        <h1>
          <DollarSign size={24} style={{ verticalAlign: "middle" }} /> Recurring
          Expenses
        </h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <TrendingUp size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                Monthly Cost
              </span>
            </div>
            <div className="stat-number" style={{ color: "var(--accent)" }}>
              {fmt(summary.total_monthly)}
            </div>
            <div className="stat-label">
              {summary.active_count} active expense
              {summary.active_count !== 1 && "s"}
            </div>
          </div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Calendar size={16} style={{ color: "var(--success)" }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                Annual Cost
              </span>
            </div>
            <div className="stat-number" style={{ color: "var(--success)" }}>
              {fmt(summary.total_annual)}
            </div>
            <div className="stat-label">projected yearly total</div>
          </div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                Upcoming Renewals
              </span>
            </div>
            <div className="stat-number" style={{ color: "var(--warning)" }}>
              {summary.upcoming_renewals.length}
            </div>
            <div className="stat-label">within next 30 days</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "0.8125rem",
            alignSelf: "center",
          }}
        >
          {expenses.length} expense{expenses.length !== 1 && "s"}
        </span>
      </div>

      {/* Expense list */}
      {expenses.length === 0 ? (
        <div className="card">
          <div className="empty">No recurring expenses found.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {expenses.map((e) => {
            const rs = renewalStatus(e.renewal_date);
            return (
              <div
                key={e.id}
                className="card"
                style={{
                  opacity: e.active ? 1 : 0.5,
                  borderColor:
                    rs === "overdue"
                      ? "var(--danger)"
                      : rs === "warning"
                        ? "var(--warning)"
                        : "var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                  }}
                >
                  {/* Left: info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span style={{ fontSize: "1rem", fontWeight: 600 }}>
                        {e.name}
                      </span>
                      <span
                        className="badge badge-category"
                        style={{
                          backgroundColor: CATEGORY_COLORS[e.category],
                        }}
                      >
                        {catLabel(e.category)}
                      </span>
                      {!e.active && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(113,113,122,0.15)",
                            color: "var(--text-muted)",
                          }}
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                    {e.provider && (
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--text-muted)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {e.provider}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span>
                        <strong>{fmt(e.amount)}</strong> / {freqLabel(e.frequency).toLowerCase()}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        ({fmt(e.monthly_cost)}/mo)
                      </span>
                      {e.renewal_date && (
                        <span
                          style={{
                            color:
                              rs === "overdue"
                                ? "var(--danger)"
                                : rs === "warning"
                                  ? "var(--warning)"
                                  : "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <Calendar size={12} />
                          Renews {e.renewal_date}
                          {rs === "overdue" && " (past due)"}
                        </span>
                      )}
                      {e.auto_renew && (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <RefreshCw size={12} /> Auto-renew
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.25rem",
                      flexShrink: 0,
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.375rem" }}
                      title={e.active ? "Mark inactive" : "Mark active"}
                      onClick={() => toggleActive(e)}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: e.active
                            ? "var(--success)"
                            : "var(--text-muted)",
                          display: "inline-block",
                        }}
                      />
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.375rem" }}
                      title="Edit"
                      onClick={() => openEdit(e)}
                    >
                      <Edit2 size={14} />
                    </button>
                    {confirmDelete === e.id ? (
                      <>
                        <button
                          className="btn btn-danger"
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                          }}
                          onClick={() => handleDelete(e.id)}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                          }}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "0.375rem" }}
                        title="Delete"
                        onClick={() => setConfirmDelete(e.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            onClick={(ev) => ev.stopPropagation()}
            style={{ width: 520, maxHeight: "90vh", overflowY: "auto" }}
          >
            <h3>{editingId ? "Edit Expense" : "Add Recurring Expense"}</h3>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, name: ev.target.value }))
                }
                placeholder='e.g. "TruGreen Lawn Service"'
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, category: ev.target.value }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={form.frequency}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, frequency: ev.target.value }))
                  }
                >
                  {EXPENSE_FREQUENCIES.map((fr) => (
                    <option key={fr.value} value={fr.value}>
                      {fr.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, amount: ev.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Provider</label>
                <input
                  type="text"
                  value={form.provider}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, provider: ev.target.value }))
                  }
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, start_date: ev.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Renewal Date</label>
                <input
                  type="date"
                  value={form.renewal_date}
                  onChange={(ev) =>
                    setForm((f) => ({
                      ...f,
                      renewal_date: ev.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label>Contractor</label>
              <select
                value={form.contractor_id}
                onChange={(ev) =>
                  setForm((f) => ({
                    ...f,
                    contractor_id: ev.target.value,
                  }))
                }
              >
                <option value="">None</option>
                {contractors.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} ({c.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, notes: ev.target.value }))
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.auto_renew}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        auto_renew: ev.target.checked,
                      }))
                    }
                  />
                  Auto-renew
                </label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        active: ev.target.checked,
                      }))
                    }
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingId ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
