import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTimeline, CATEGORY_COLORS, CATEGORIES, PRIORITY_COLORS, formatMinutes, type Timeline as TimelineData } from "../api";
import { format, parse } from "date-fns";

export default function Timeline() {
  const [data, setData] = useState<TimelineData | null>(null);
  useEffect(() => { fetchTimeline().then(setData); }, []);

  if (!data) return <div className="empty">Loading...</div>;

  const sortedMonths = Object.entries(data.months).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="page-header">
        <h1>Year Timeline</h1>
      </div>

      {sortedMonths.length === 0 && (
        <div className="card"><div className="empty">No tasks scheduled in the next year.</div></div>
      )}

      {sortedMonths.map(([monthKey, tasks]) => {
        const monthDate = parse(monthKey, "yyyy-MM", new Date());
        const monthLabel = format(monthDate, "MMMM yyyy");
        const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
        const isCurrentMonth = monthKey === format(new Date(), "yyyy-MM");

        return (
          <div key={monthKey} className="card" style={{
            marginBottom: "1rem",
            borderLeft: isCurrentMonth ? "3px solid var(--accent)" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: isCurrentMonth ? "var(--accent)" : "var(--text-muted)" }}>
                {monthLabel}
                {isCurrentMonth && " (current)"}
              </h3>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                {tasks.length} task{tasks.length !== 1 && "s"}
                {totalMinutes > 0 && ` · ${formatMinutes(totalMinutes)}`}
              </span>
            </div>
            {tasks.map((task) => (
              <Link key={task.id} to={`/tasks/${task.id}`} className="task-item" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="task-info">
                  <span className="cat-dot" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                  <span className="task-name">{task.name}</span>
                  {task.estimated_minutes && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatMinutes(task.estimated_minutes)}</span>
                  )}
                </div>
                <div className="task-meta">
                  <span className="badge badge-category" style={{ backgroundColor: CATEGORY_COLORS[task.category] }}>
                    {CATEGORIES.find((c) => c.value === task.category)?.label}
                  </span>
                  {task.next_due && (
                    <span className="badge badge-upcoming">{format(new Date(task.next_due + "T00:00:00"), "MMM d")}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
