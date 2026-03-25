import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Trash2, AlarmClockOff, Package, Pencil } from "lucide-react";
import {
  fetchTask, completeTask, deleteTask, snoozeTask, updateTask, createSupply, deleteSupply, updateSupply,
  CATEGORIES, FREQUENCIES, PRIORITIES, SEASONS, CATEGORY_COLORS, PRIORITY_COLORS, formatMinutes,
  type TaskWithHistory, type Supply,
} from "../api";
import { format, formatDistanceToNow } from "date-fns";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskWithHistory | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [supplyName, setSupplyName] = useState("");
  const [supplyUrl, setSupplyUrl] = useState("");
  const [supplyQty, setSupplyQty] = useState("0");
  const [supplyPerUse, setSupplyPerUse] = useState("1");
  const [editForm, setEditForm] = useState({
    name: "", description: "", category: "", frequency: "", season: "",
    priority: "", estimated_minutes: "", prefer_weekend: true, next_due: "",
  });

  const load = () => { if (id) fetchTask(Number(id)).then(setTask); };
  useEffect(load, [id]);

  async function handleComplete() {
    if (!task) return;
    await completeTask(task.id, {
      notes: notes || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      duration_minutes: duration ? parseInt(duration) : undefined,
      photo_url: photoUrl || undefined,
    });
    setShowComplete(false);
    setNotes(""); setCost(""); setDuration(""); setPhotoUrl("");
    load();
  }

  async function handleSnooze(days: number) {
    if (!task) return;
    await snoozeTask(task.id, days);
    load();
  }

  async function handleDelete() {
    if (!task || !confirm("Delete this task?")) return;
    await deleteTask(task.id);
    navigate("/tasks");
  }

  function openEdit() {
    if (!task) return;
    setEditForm({
      name: task.name,
      description: task.description || "",
      category: task.category,
      frequency: task.frequency,
      season: task.season || "",
      priority: task.priority,
      estimated_minutes: task.estimated_minutes?.toString() || "",
      prefer_weekend: task.prefer_weekend,
      next_due: task.next_due || "",
    });
    setShowEdit(true);
  }

  async function handleEdit() {
    if (!task) return;
    await updateTask(task.id, {
      name: editForm.name,
      description: editForm.description || undefined,
      category: editForm.category,
      frequency: editForm.frequency,
      season: editForm.season || undefined,
      priority: editForm.priority,
      estimated_minutes: editForm.estimated_minutes ? parseInt(editForm.estimated_minutes) : undefined,
      prefer_weekend: editForm.prefer_weekend,
      next_due: editForm.next_due || undefined,
    } as any);
    setShowEdit(false);
    load();
  }

  async function handleAddSupply() {
    if (!task || !supplyName) return;
    await createSupply(task.id, {
      name: supplyName,
      url: supplyUrl || undefined,
      quantity_on_hand: parseInt(supplyQty) || 0,
      quantity_per_use: parseInt(supplyPerUse) || 1,
    });
    setShowAddSupply(false);
    setSupplyName(""); setSupplyUrl(""); setSupplyQty("0"); setSupplyPerUse("1");
    load();
  }

  async function handleUpdateSupplyQty(supply: Supply, delta: number) {
    const newQty = Math.max(0, supply.quantity_on_hand + delta);
    await updateSupply(supply.id, { quantity_on_hand: newQty });
    load();
  }

  async function handleDeleteSupply(supplyId: number) {
    await deleteSupply(supplyId);
    load();
  }

  if (!task) return <div className="empty">Loading...</div>;

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = task.next_due && task.next_due < today;
  const catLabel = CATEGORIES.find((c) => c.value === task.category)?.label ?? task.category;
  const freqLabel = FREQUENCIES.find((f) => f.value === task.frequency)?.label ?? task.frequency;
  const priorityLabel = PRIORITIES.find((p) => p.value === task.priority)?.label ?? task.priority;
  const seasonLabel = task.season ? SEASONS.find((s) => s.value === task.season)?.label : null;
  const totalCost = task.completions.reduce((sum, c) => sum + (c.cost || 0), 0);

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>{task.name}</h1>
            {task.description && <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>{task.description}</p>}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" onClick={openEdit}>
              <Pencil size={16} /> Edit
            </button>
            <button className="btn btn-success" onClick={() => { setShowComplete(true); setDuration(task.estimated_minutes?.toString() || ""); }}>
              <CheckCircle size={16} /> Complete
            </button>
            <button className="btn btn-ghost" onClick={() => handleSnooze(7)}>
              <AlarmClockOff size={16} /> +7d
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[task.category] }}>{catLabel}</span>
          <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[task.priority] + "22", color: PRIORITY_COLORS[task.priority] }}>
            {priorityLabel}
          </span>
          <span className="badge badge-upcoming">{freqLabel}</span>
          {seasonLabel && <span className="badge badge-ok">{seasonLabel}</span>}
          {task.estimated_minutes && <span className="badge badge-upcoming">{formatMinutes(task.estimated_minutes)}</span>}
          {task.prefer_weekend && <span className="badge badge-ok">Weekend</span>}
        </div>

        {task.next_due && (
          <div style={{ fontSize: "0.875rem" }}>
            <strong>Next due:</strong>{" "}
            <span style={{ color: isOverdue ? "var(--danger)" : "var(--text)" }}>
              {format(new Date(task.next_due + "T00:00:00"), "EEEE, MMMM d, yyyy")}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          {task.last_completed && (
            <span>Last completed {formatDistanceToNow(new Date(task.last_completed), { addSuffix: true })}</span>
          )}
          {totalCost > 0 && <span>Total spent: ${totalCost.toFixed(2)}</span>}
          <span>{task.completions.length} completion{task.completions.length !== 1 && "s"}</span>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Snooze:</span>
          {[1, 3, 7, 14, 30].map((d) => (
            <button key={d} className="btn btn-ghost" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }} onClick={() => handleSnooze(d)}>
              +{d}d
            </button>
          ))}
        </div>
      </div>

      {/* Supplies */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3><Package size={14} style={{ verticalAlign: "middle" }} /> Supplies</h3>
          <button className="btn btn-ghost" style={{ fontSize: "0.75rem" }} onClick={() => setShowAddSupply(true)}>+ Add Supply</button>
        </div>
        {task.supplies.length === 0 && <div className="empty">No supplies tracked for this task.</div>}
        {task.supplies.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ flex: 1, fontSize: "0.875rem" }}>
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{s.name}</a> : s.name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <button className="btn btn-ghost" style={{ padding: "0.1rem 0.3rem", fontSize: "0.75rem" }} onClick={() => handleUpdateSupplyQty(s, -1)}>-</button>
              <span style={{ minWidth: "2rem", textAlign: "center", fontSize: "0.875rem", color: s.quantity_on_hand <= s.quantity_per_use ? "var(--danger)" : "var(--text)" }}>
                {s.quantity_on_hand}
              </span>
              <button className="btn btn-ghost" style={{ padding: "0.1rem 0.3rem", fontSize: "0.75rem" }} onClick={() => handleUpdateSupplyQty(s, 1)}>+</button>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>/{s.quantity_per_use} per use</span>
            <button className="btn btn-ghost" style={{ padding: "0.1rem 0.3rem", fontSize: "0.7rem", color: "var(--danger)" }} onClick={() => handleDeleteSupply(s.id)}>x</button>
          </div>
        ))}
      </div>

      {/* Completion History */}
      <div className="card">
        <h3>Completion History</h3>
        {task.completions.length === 0 && <div className="empty">No completions yet.</div>}
        {task.completions.map((c) => (
          <div key={c.id} className="completion-item" style={{ flexWrap: "wrap" }}>
            <CheckCircle size={14} color="var(--success)" />
            <span>{format(new Date(c.completed_at), "MMM d, yyyy 'at' h:mm a")}</span>
            {c.duration_minutes && <span className="badge badge-upcoming">{formatMinutes(c.duration_minutes)}</span>}
            {c.cost && <span className="badge badge-ok">${Number(c.cost).toFixed(2)}</span>}
            {c.photo_url && <a href={c.photo_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "var(--accent)" }}>Photo</a>}
            {c.notes && <span style={{ color: "var(--text-muted)", width: "100%", paddingLeft: "1.75rem", fontSize: "0.8125rem" }}>{c.notes}</span>}
          </div>
        ))}
      </div>

      {showComplete && (
        <div className="modal-overlay" onClick={() => setShowComplete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Complete: {task.name}</h3>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Cost ($)</label>
                <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Time (minutes)</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Photo URL</label>
              <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowComplete(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleComplete}>Mark Complete</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
            <h3>Edit Task</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select value={editForm.frequency} onChange={(e) => setEditForm((f) => ({ ...f, frequency: e.target.value }))}>
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Priority</label>
                <select value={editForm.priority} onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Estimated Time (min)</label>
                <input type="number" value={editForm.estimated_minutes} onChange={(e) => setEditForm((f) => ({ ...f, estimated_minutes: e.target.value }))} />
              </div>
            </div>
            {editForm.frequency === "seasonal" && (
              <div className="form-group">
                <label>Season</label>
                <select value={editForm.season} onChange={(e) => setEditForm((f) => ({ ...f, season: e.target.value }))}>
                  <option value="">None</option>
                  {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Next Due Date</label>
              <input type="date" value={editForm.next_due} onChange={(e) => setEditForm((f) => ({ ...f, next_due: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="checkbox">
                <input type="checkbox" checked={editForm.prefer_weekend} onChange={(e) => setEditForm((f) => ({ ...f, prefer_weekend: e.target.checked }))} />
                Prefer weekends (snap due dates to Saturday)
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showAddSupply && (
        <div className="modal-overlay" onClick={() => setShowAddSupply(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Supply</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={supplyName} onChange={(e) => setSupplyName(e.target.value)} placeholder="e.g. HVAC Filter 20x25x1" />
            </div>
            <div className="form-group">
              <label>Link (optional)</label>
              <input type="url" value={supplyUrl} onChange={(e) => setSupplyUrl(e.target.value)} placeholder="https://amazon.com/..." />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>On Hand</label>
                <input type="number" value={supplyQty} onChange={(e) => setSupplyQty(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Per Use</label>
                <input type="number" value={supplyPerUse} onChange={(e) => setSupplyPerUse(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddSupply(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddSupply}>Add Supply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
