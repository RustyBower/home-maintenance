import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTask, CATEGORIES, FREQUENCIES, PRIORITIES, SEASONS } from "../api";

export default function AddTask() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "other",
    frequency: "monthly",
    season: "",
    priority: "p2",
    estimated_minutes: "",
    prefer_weekend: true,
    next_due: "",
  });

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createTask({
      name: form.name,
      description: form.description || undefined,
      category: form.category,
      frequency: form.frequency,
      season: form.season || undefined,
      priority: form.priority,
      estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes) : undefined,
      prefer_weekend: form.prefer_weekend,
      next_due: form.next_due || undefined,
    });
    navigate("/tasks");
  }

  return (
    <div>
      <div className="page-header">
        <h1>Add Task</h1>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Frequency</label>
              <select value={form.frequency} onChange={(e) => update("frequency", e.target.value)}>
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Estimated Time (minutes)</label>
              <input type="number" value={form.estimated_minutes} onChange={(e) => update("estimated_minutes", e.target.value)} placeholder="e.g. 30" />
            </div>
          </div>
          {form.frequency === "seasonal" && (
            <div className="form-group">
              <label>Season</label>
              <select value={form.season} onChange={(e) => update("season", e.target.value)}>
                <option value="">Select season...</option>
                {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="checkbox">
              <input type="checkbox" checked={form.prefer_weekend} onChange={(e) => update("prefer_weekend", e.target.checked)} />
              Prefer weekends (snap due dates to Saturday)
            </label>
          </div>
          <div className="form-group">
            <label>First Due Date (optional — auto-calculated if empty)</label>
            <input type="date" value={form.next_due} onChange={(e) => update("next_due", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary">Create Task</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/tasks")}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
