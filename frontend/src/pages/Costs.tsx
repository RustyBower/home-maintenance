import { useEffect, useState } from "react";
import { fetchCosts, CATEGORY_COLORS, CATEGORIES, formatMinutes, type CostSummary } from "../api";
import { format } from "date-fns";

function categoryLabel(val: string) {
  return CATEGORIES.find((c) => c.value === val)?.label ?? val;
}

export default function Costs() {
  const [data, setData] = useState<CostSummary | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { fetchCosts(year).then(setData); }, [year]);

  if (!data) return <div className="empty">Loading...</div>;

  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 5; y--) {
    years.push(y);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Cost Tracking</h1>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: "0.375rem 0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)" }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <h3>Total Spent</h3>
          <div className="stat-number" style={{ color: "var(--accent)" }}>${data.total_cost.toFixed(2)}</div>
          <div className="stat-label">{data.year}</div>
        </div>
        <div className="card">
          <h3>By Category</h3>
          {Object.keys(data.by_category).length === 0 ? (
            <div className="empty">No costs recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {Object.entries(data.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="cat-dot" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    <span style={{ flex: 1, fontSize: "0.875rem" }}>{categoryLabel(cat)}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>${amount.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Expense History</h3>
        {data.completions.length === 0 && <div className="empty">No expenses recorded for {year}.</div>}
        {data.completions.map((c) => (
          <div key={c.id} className="completion-item">
            <span>{format(new Date(c.completed_at), "MMM d, yyyy")}</span>
            <span style={{ fontWeight: 600 }}>${Number(c.cost).toFixed(2)}</span>
            {c.duration_minutes && <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{formatMinutes(c.duration_minutes)}</span>}
            {c.notes && <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>— {c.notes}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
