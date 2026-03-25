import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, Clock, Calendar, Timer } from "lucide-react";
import {
  fetchDashboard, completeTask, snoozeTask, CATEGORY_COLORS, CATEGORIES, PRIORITY_COLORS, formatMinutes,
  type Dashboard as DashboardData, type Task,
} from "../api";
import { format, formatDistanceToNow } from "date-fns";

function categoryLabel(val: string) {
  return CATEGORIES.find((c) => c.value === val)?.label ?? val;
}

function CompleteModal({ task, onClose, onComplete }: {
  task: Task;
  onClose: () => void;
  onComplete: (data: { notes: string; cost: string; duration_minutes: string }) => void;
}) {
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState(task.estimated_minutes?.toString() || "");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Complete: {task.name}</h3>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this completion..." />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Cost ($)</label>
            <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label>Time (minutes)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={task.estimated_minutes?.toString() || ""} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={() => onComplete({ notes, cost, duration_minutes: duration })}>Mark Complete</button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, onComplete, onSnooze }: { task: Task; onComplete: (t: Task) => void; onSnooze: (t: Task) => void }) {
  const isOverdue = task.next_due && new Date(task.next_due) < new Date(new Date().toDateString());
  const isToday = task.next_due && task.next_due === new Date().toISOString().split("T")[0];

  return (
    <div className="task-item">
      <Link to={`/tasks/${task.id}`} className="task-info" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="cat-dot" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
        <span className="task-name">{task.name}</span>
        {task.estimated_minutes && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <Timer size={12} style={{ verticalAlign: "middle" }} /> {formatMinutes(task.estimated_minutes)}
          </span>
        )}
      </Link>
      <div className="task-meta">
        <span className={`badge ${isOverdue ? "badge-overdue" : isToday ? "badge-due-today" : "badge-upcoming"}`}>
          {task.next_due ? format(new Date(task.next_due + "T00:00:00"), "MMM d") : "No date"}
        </span>
        <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }} onClick={() => onSnooze(task)}>
          Snooze
        </button>
        <button className="btn btn-success" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => onComplete(task)}>
          <CheckCircle size={14} /> Done
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);

  const load = () => fetchDashboard().then(setData);
  useEffect(() => {
    fetch("/api/setup/status").then((r) => r.json()).then((s) => {
      if (!s.has_tasks) navigate("/setup", { replace: true });
    });
    load();
  }, []);

  async function handleComplete(form: { notes: string; cost: string; duration_minutes: string }) {
    if (!completing) return;
    await completeTask(completing.id, {
      notes: form.notes || undefined,
      cost: form.cost ? parseFloat(form.cost) : undefined,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
    });
    setCompleting(null);
    load();
  }

  async function handleSnooze(task: Task) {
    await snoozeTask(task.id, 7);
    load();
  }

  if (!data) return <div className="empty">Loading...</div>;

  const { overdue, due_today, upcoming, time_estimates } = data;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/weekend" className="btn btn-primary">Plan My Weekend</Link>
      </div>

      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Overdue</span>
          </div>
          <div className="stat-number" style={{ color: overdue.length > 0 ? "var(--danger)" : "var(--success)" }}>{overdue.length}</div>
          {time_estimates.overdue_minutes > 0 && (
            <div className="stat-label">{formatMinutes(time_estimates.overdue_minutes)} estimated</div>
          )}
        </div>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Clock size={16} color="var(--warning)" />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Due Today</span>
          </div>
          <div className="stat-number" style={{ color: due_today.length > 0 ? "var(--warning)" : "var(--text-muted)" }}>{due_today.length}</div>
          {time_estimates.today_minutes > 0 && (
            <div className="stat-label">{formatMinutes(time_estimates.today_minutes)} estimated</div>
          )}
        </div>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Calendar size={16} color="var(--accent)" />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Next 7 Days</span>
          </div>
          <div className="stat-number">{upcoming.length}</div>
          {time_estimates.upcoming_minutes > 0 && (
            <div className="stat-label">{formatMinutes(time_estimates.upcoming_minutes)} estimated</div>
          )}
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "rgba(239, 68, 68, 0.3)" }}>
          <h3 style={{ color: "var(--danger)" }}>Overdue</h3>
          {overdue.map((t) => <TaskRow key={t.id} task={t} onComplete={setCompleting} onSnooze={handleSnooze} />)}
        </div>
      )}

      {due_today.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ color: "var(--warning)" }}>Due Today</h3>
          {due_today.map((t) => <TaskRow key={t.id} task={t} onComplete={setCompleting} onSnooze={handleSnooze} />)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>Upcoming (7 days)</h3>
          {upcoming.map((t) => <TaskRow key={t.id} task={t} onComplete={setCompleting} onSnooze={handleSnooze} />)}
        </div>
      )}

      {overdue.length === 0 && due_today.length === 0 && upcoming.length === 0 && (
        <div className="card"><div className="empty">Nothing due in the next 7 days. Nice work!</div></div>
      )}

      {data.recent_completions.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Recently Completed</h3>
          {data.recent_completions.map((c) => (
            <div key={c.id} className="completion-item">
              <CheckCircle size={14} color="var(--success)" />
              <span>{formatDistanceToNow(new Date(c.completed_at), { addSuffix: true })}</span>
              {c.cost && <span className="badge badge-upcoming">${c.cost.toFixed(2)}</span>}
              {c.duration_minutes && <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{formatMinutes(c.duration_minutes)}</span>}
              {c.notes && <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>— {c.notes}</span>}
            </div>
          ))}
        </div>
      )}

      {Object.keys(data.overdue_by_category).length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Overdue by Category</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {Object.entries(data.overdue_by_category).map(([cat, count]) => (
              <span key={cat} className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[cat] }}>
                {categoryLabel(cat)}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {completing && <CompleteModal task={completing} onClose={() => setCompleting(null)} onComplete={handleComplete} />}
    </div>
  );
}
