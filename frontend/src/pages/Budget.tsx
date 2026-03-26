import { useEffect, useState } from "react";
import { CATEGORIES } from "../api";

const API_BASE = "/api";

// ---- Interfaces ----

interface ForecastTask {
  name: string;
  estimated_cost: number;
  due: string;
}

interface ForecastMonth {
  month: string;
  label: string;
  maintenance_cost: number;
  recurring_expenses: number;
  estimated_repairs: number;
  total: number;
  tasks: ForecastTask[];
}

interface ForecastResponse {
  months: ForecastMonth[];
  annual_total: number;
  monthly_average: number;
}

interface AssetReplacement {
  asset_id: number;
  name: string;
  category: string;
  install_date: string | null;
  age_years: number;
  expected_lifespan_years: number;
  remaining_years: number;
  estimated_replacement_year: number;
  purchase_price: number | null;
  urgency: "ok" | "approaching" | "overdue";
}

interface AssetReplacementResponse {
  upcoming: AssetReplacement[];
  total_replacement_value: number;
}

interface BudgetSummary {
  current_year: {
    spent_maintenance: number;
    spent_repairs: number;
    spent_recurring: number;
    total_spent: number;
    forecasted_remaining: number;
    forecasted_annual: number;
  };
  monthly_recurring: number;
  annual_recurring: number;
  next_big_expense: {
    name: string;
    estimated_cost: number;
    due: string;
  } | null;
}

// ---- API helpers ----

async function fetchForecast(): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/budget/forecast`);
  if (!res.ok) throw new Error("Failed to fetch forecast");
  return res.json();
}

async function fetchAssetReplacements(): Promise<AssetReplacementResponse> {
  const res = await fetch(`${API_BASE}/budget/asset-replacements`);
  if (!res.ok) throw new Error("Failed to fetch asset replacements");
  return res.json();
}

async function fetchBudgetSummary(): Promise<BudgetSummary> {
  const res = await fetch(`${API_BASE}/budget/summary`);
  if (!res.ok) throw new Error("Failed to fetch budget summary");
  return res.json();
}

// ---- Helpers ----

function categoryLabel(val: string) {
  return CATEGORIES.find((c) => c.value === val)?.label ?? val;
}

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const URGENCY_COLORS: Record<string, string> = {
  ok: "#22c55e",
  approaching: "#f59e0b",
  overdue: "#ef4444",
};

const URGENCY_LABELS: Record<string, string> = {
  ok: "OK",
  approaching: "Approaching",
  overdue: "Overdue",
};

// ---- Component ----

export default function Budget() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [replacements, setReplacements] = useState<AssetReplacementResponse | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    fetchBudgetSummary().then(setSummary);
    fetchForecast().then(setForecast);
    fetchAssetReplacements().then(setReplacements);
  }, []);

  if (!summary || !forecast || !replacements) {
    return <div className="empty">Loading budget data...</div>;
  }

  const maxMonthTotal = Math.max(...forecast.months.map((m) => m.total), 1);
  const highThreshold = forecast.monthly_average * 1.3;

  return (
    <div>
      <div className="page-header">
        <h1>Budget &amp; Forecasting</h1>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <h3>Spent This Year</h3>
          <div className="stat-number" style={{ color: "var(--accent)" }}>
            {formatCurrency(summary.current_year.total_spent)}
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            <span>Maintenance: {formatCurrency(summary.current_year.spent_maintenance)}</span>
            <span>Repairs: {formatCurrency(summary.current_year.spent_repairs)}</span>
            <span>Recurring: {formatCurrency(summary.current_year.spent_recurring)}</span>
          </div>
        </div>

        <div className="card">
          <h3>Forecasted Annual</h3>
          <div className="stat-number" style={{ color: "var(--warning)" }}>
            {formatCurrency(summary.current_year.forecasted_annual)}
          </div>
          <div className="stat-label">
            {formatCurrency(summary.current_year.forecasted_remaining)} remaining
          </div>
        </div>

        <div className="card">
          <h3>Monthly Recurring</h3>
          <div className="stat-number" style={{ color: "var(--text)" }}>
            {formatCurrency(summary.monthly_recurring)}
          </div>
          <div className="stat-label">
            {formatCurrency(summary.annual_recurring)} / year
          </div>
        </div>

        <div className="card">
          <h3>Next Big Expense</h3>
          {summary.next_big_expense ? (
            <>
              <div className="stat-number" style={{ color: "var(--danger)", fontSize: "1.5rem" }}>
                {formatCurrency(summary.next_big_expense.estimated_cost)}
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                {summary.next_big_expense.name}
              </div>
              <div className="stat-label">
                Due {formatDate(summary.next_big_expense.due)}
              </div>
            </>
          ) : (
            <div className="empty">No upcoming expenses</div>
          )}
        </div>
      </div>

      {/* 12-Month Forecast */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3>12-Month Forecast</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "140px 100px 100px 80px 100px 1fr",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            borderBottom: "1px solid var(--border)",
          }}>
            <span>Month</span>
            <span style={{ textAlign: "right" }}>Maintenance</span>
            <span style={{ textAlign: "right" }}>Recurring</span>
            <span style={{ textAlign: "right" }}>Repairs</span>
            <span style={{ textAlign: "right" }}>Total</span>
            <span />
          </div>

          {forecast.months.map((m) => {
            const isHigh = m.total > highThreshold;
            const barPct = Math.min(100, (m.total / maxMonthTotal) * 100);
            const isExpanded = expandedMonth === m.month;

            return (
              <div key={m.month}>
                <div
                  onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 100px 100px 80px 100px 1fr",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    background: isHigh ? "rgba(245, 158, 11, 0.06)" : "transparent",
                    borderLeft: isHigh ? "3px solid var(--warning)" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isHigh ? "rgba(245, 158, 11, 0.1)" : "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isHigh ? "rgba(245, 158, 11, 0.06)" : "transparent")}
                >
                  <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{m.label}</span>
                  <span style={{ textAlign: "right", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    {m.maintenance_cost > 0 ? formatCurrency(m.maintenance_cost) : "—"}
                  </span>
                  <span style={{ textAlign: "right", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    {m.recurring_expenses > 0 ? formatCurrency(m.recurring_expenses) : "—"}
                  </span>
                  <span style={{ textAlign: "right", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    {m.estimated_repairs > 0 ? formatCurrency(m.estimated_repairs) : "—"}
                  </span>
                  <span style={{
                    textAlign: "right",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: isHigh ? "var(--warning)" : "var(--text)",
                  }}>
                    {formatCurrency(m.total)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", paddingLeft: "0.5rem" }}>
                    <div style={{
                      height: "16px",
                      width: `${barPct}%`,
                      minWidth: m.total > 0 ? "4px" : "0",
                      borderRadius: "3px",
                      background: isHigh
                        ? "linear-gradient(90deg, var(--warning), #d97706)"
                        : "linear-gradient(90deg, var(--accent), #2563eb)",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                </div>

                {/* Expanded task details */}
                {isExpanded && m.tasks.length > 0 && (
                  <div style={{
                    padding: "0.5rem 0.75rem 0.5rem 2rem",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    {m.tasks.map((t, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.25rem 0",
                        fontSize: "0.8125rem",
                        color: "var(--text-muted)",
                      }}>
                        <span>{t.name}</span>
                        <span style={{ display: "flex", gap: "1rem" }}>
                          <span>{formatDate(t.due)}</span>
                          <span style={{ fontWeight: 500, color: t.estimated_cost > 0 ? "var(--text)" : "var(--text-muted)" }}>
                            {t.estimated_cost > 0 ? formatCurrency(t.estimated_cost) : "No cost data"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Total row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "140px 100px 100px 80px 100px 1fr",
            gap: "0.5rem",
            padding: "0.75rem 0.75rem",
            borderTop: "2px solid var(--border)",
            marginTop: "0.25rem",
          }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>Total</span>
            <span style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 600 }}>
              {formatCurrency(forecast.months.reduce((s, m) => s + m.maintenance_cost, 0))}
            </span>
            <span style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 600 }}>
              {formatCurrency(forecast.months.reduce((s, m) => s + m.recurring_expenses, 0))}
            </span>
            <span style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 600 }}>
              {formatCurrency(forecast.months.reduce((s, m) => s + m.estimated_repairs, 0))}
            </span>
            <span style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 700, color: "var(--accent)" }}>
              {formatCurrency(forecast.annual_total)}
            </span>
            <span style={{ paddingLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)", alignSelf: "center" }}>
              avg {formatCurrency(forecast.monthly_average)}/mo
            </span>
          </div>
        </div>
      </div>

      {/* Asset Replacement Timeline */}
      <div className="card">
        <h3>Asset Replacement Timeline</h3>
        {replacements.upcoming.length === 0 ? (
          <div className="empty">No assets with lifespan data.</div>
        ) : (
          <>
            {replacements.upcoming.map((a) => {
              const lifespanPct = Math.min(100, (a.age_years / a.expected_lifespan_years) * 100);
              const barColor = a.urgency === "overdue"
                ? "var(--danger)"
                : a.urgency === "approaching"
                  ? "var(--warning)"
                  : "var(--success)";

              return (
                <div key={a.asset_id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {/* Info */}
                  <div style={{ flex: "0 0 200px", minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {categoryLabel(a.category)}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      height: "8px",
                      background: "var(--bg)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${lifespanPct}%`,
                        background: barColor,
                        borderRadius: "4px",
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "0.25rem",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}>
                      <span>{a.age_years} yrs old</span>
                      <span>{a.expected_lifespan_years} yr lifespan</span>
                    </div>
                  </div>

                  {/* Remaining */}
                  <div style={{ flex: "0 0 100px", textAlign: "right" }}>
                    <div style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: URGENCY_COLORS[a.urgency],
                    }}>
                      {a.remaining_years > 0 ? `${a.remaining_years} yrs left` : `${Math.abs(a.remaining_years)} yrs over`}
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: `${URGENCY_COLORS[a.urgency]}22`,
                        color: URGENCY_COLORS[a.urgency],
                        fontSize: "0.6875rem",
                      }}
                    >
                      {URGENCY_LABELS[a.urgency]}
                    </span>
                  </div>

                  {/* Replacement cost */}
                  <div style={{ flex: "0 0 100px", textAlign: "right" }}>
                    {a.purchase_price ? (
                      <>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{formatCurrency(a.purchase_price)}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>est. {a.estimated_replacement_year}</div>
                      </>
                    ) : (
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Total replacement value */}
            {replacements.total_replacement_value > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "0.75rem 0 0",
                fontSize: "0.875rem",
              }}>
                <span style={{ color: "var(--text-muted)", marginRight: "0.5rem" }}>Total replacement value:</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(replacements.total_replacement_value)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
