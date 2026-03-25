import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Timer, Wrench } from "lucide-react";
import { fetchWeekendPlan, completeTask, PRIORITY_COLORS, CATEGORY_COLORS, CATEGORIES, formatMinutes, type WeekendPlan, type Task } from "../api";
import { format } from "date-fns";

export default function WeekendPlanner() {
  const [plan, setPlan] = useState<WeekendPlan | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState("");

  const load = () => fetchWeekendPlan().then(setPlan);
  useEffect(() => { load(); }, []);

  async function handleComplete() {
    if (!completing) return;
    await completeTask(completing.id, {
      notes: notes || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      duration_minutes: duration ? parseInt(duration) : undefined,
    });
    setCompleting(null);
    setNotes(""); setCost(""); setDuration("");
    load();
  }

  if (!plan) return <div className="empty">Loading...</div>;

  const weekendDate = format(new Date(plan.weekend_date + "T00:00:00"), "EEEE, MMMM d");

  return (
    <div>
      <div className="page-header">
        <h1><Wrench size={24} style={{ verticalAlign: "middle" }} /> Weekend Plan</h1>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ color: "var(--text)", textTransform: "none", letterSpacing: "normal", fontSize: "1rem" }}>{weekendDate}</h3>
            <div className="stat-label">{plan.total_tasks} tasks due</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="stat-number">{formatMinutes(plan.total_minutes)}</div>
            <div className="stat-label">estimated total</div>
          </div>
        </div>
      </div>

      {plan.total_tasks === 0 && (
        <div className="card"><div className="empty">Nothing due this weekend. Enjoy your time off!</div></div>
      )}

      {["p1", "p2", "p3"].map((p) => {
        const group = plan.by_priority[p];
        if (!group) return null;
        const label = p === "p1" ? "Critical" : p === "p2" ? "Important" : "Nice to Have";
        return (
          <div key={p} className="card" style={{ marginBottom: "1rem", borderLeft: `3px solid ${PRIORITY_COLORS[p]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ color: PRIORITY_COLORS[p] }}>{label}</h3>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                {group.tasks.length} task{group.tasks.length !== 1 && "s"} · {formatMinutes(group.total_minutes)}
              </span>
            </div>
            {group.tasks.map((task) => (
              <div key={task.id} className="task-item">
                <Link to={`/tasks/${task.id}`} className="task-info" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="cat-dot" style={{ backgroundColor: CATEGORY_COLORS[task.category] }} />
                  <span className="task-name">{task.name}</span>
                  {task.estimated_minutes && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      <Timer size={12} style={{ verticalAlign: "middle" }} /> {formatMinutes(task.estimated_minutes)}
                    </span>
                  )}
                </Link>
                <div className="task-meta">
                  <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[task.category] }}>
                    {CATEGORIES.find((c) => c.value === task.category)?.label}
                  </span>
                  <button className="btn btn-success" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => { setCompleting(task); setDuration(task.estimated_minutes?.toString() || ""); }}>
                    <CheckCircle size={14} /> Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {completing && (
        <div className="modal-overlay" onClick={() => setCompleting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Complete: {completing.name}</h3>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Cost ($)</label>
                <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Time (min)</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCompleting(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleComplete}>Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
