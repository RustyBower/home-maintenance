import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Timer, AlarmClockOff } from "lucide-react";
import { fetchTasks, completeTask, snoozeTask, CATEGORIES, FREQUENCIES, PRIORITIES, CATEGORY_COLORS, PRIORITY_COLORS, formatMinutes, type Task } from "../api";
import { format } from "date-fns";

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("");
  const [priority, setPriority] = useState("");
  const [completing, setCompleting] = useState<Task | null>(null);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState("");

  const load = () => {
    const params: Record<string, string | boolean> = {};
    if (category) params.category = category;
    if (frequency) params.frequency = frequency;
    if (priority) params.priority = priority;
    fetchTasks(params).then(setTasks);
  };

  useEffect(load, [category, frequency, priority]);

  async function handleComplete() {
    if (!completing) return;
    await completeTask(completing.id, {
      notes: notes || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      duration_minutes: duration ? parseInt(duration) : undefined,
    });
    setCompleting(null);
    setNotes("");
    setCost("");
    setDuration("");
    load();
  }

  async function handleSnooze(task: Task) {
    await snoozeTask(task.id, 7);
    load();
  }

  const today = new Date().toISOString().split("T")[0];

  function dueBadge(task: Task) {
    if (!task.next_due) return <span className="badge badge-upcoming">No date</span>;
    if (task.next_due < today) return <span className="badge badge-overdue">{format(new Date(task.next_due + "T00:00:00"), "MMM d")}</span>;
    if (task.next_due === today) return <span className="badge badge-due-today">Today</span>;
    return <span className="badge badge-upcoming">{format(new Date(task.next_due + "T00:00:00"), "MMM d")}</span>;
  }

  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>All Tasks</h1>
        <Link to="/tasks/new" className="btn btn-primary">Add Task</Link>
      </div>

      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="">All Frequencies</option>
          {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem", alignSelf: "center" }}>
          {tasks.length} task{tasks.length !== 1 && "s"}
          {totalMinutes > 0 && ` · ${formatMinutes(totalMinutes)} total`}
        </span>
      </div>

      <div className="card">
        {tasks.length === 0 && <div className="empty">No tasks found.</div>}
        {tasks.map((task) => (
          <div key={task.id} className="task-item">
            <Link to={`/tasks/${task.id}`} className="task-info" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="cat-dot" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
              <span className="task-name">{task.name}</span>
              {task.estimated_minutes && (
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  <Timer size={11} style={{ verticalAlign: "middle" }} /> {formatMinutes(task.estimated_minutes)}
                </span>
              )}
            </Link>
            <div className="task-meta">
              <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[task.category] }}>
                {CATEGORIES.find((c) => c.value === task.category)?.label}
              </span>
              <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[task.priority] + "22", color: PRIORITY_COLORS[task.priority] }}>
                {task.priority.toUpperCase()}
              </span>
              {dueBadge(task)}
              <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.7rem" }} onClick={() => handleSnooze(task)} title="Snooze 1 week">
                <AlarmClockOff size={13} />
              </button>
              <button className="btn btn-success" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => { setCompleting(task); setDuration(task.estimated_minutes?.toString() || ""); }}>
                <CheckCircle size={14} /> Done
              </button>
            </div>
          </div>
        ))}
      </div>

      {completing && (
        <div className="modal-overlay" onClick={() => setCompleting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Complete: {completing.name}</h3>
            <div className="form-group">
              <label>Notes (optional)</label>
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
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setCompleting(null); setNotes(""); setCost(""); setDuration(""); }}>Cancel</button>
              <button className="btn btn-success" onClick={handleComplete}>Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
