import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Check } from "lucide-react";

interface Feature {
  id: string;
  label: string;
  description: string;
  default: boolean;
  locked: boolean;
  task_count: number;
}

export default function Setup() {
  const navigate = useNavigate();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    fetch("/api/setup/features")
      .then((r) => r.json())
      .then((data: Feature[]) => {
        setFeatures(data);
        setSelected(new Set(data.filter((f) => f.default).map((f) => f.id)));
      });
  }, []);

  function toggle(id: string) {
    const f = features.find((f) => f.id === id);
    if (f?.locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/setup/populate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Array.from(selected)),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  const totalTasks = features
    .filter((f) => selected.has(f.id))
    .reduce((sum, f) => sum + f.task_count, 0);

  if (result) {
    return (
      <div style={{ maxWidth: 600, margin: "3rem auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "2rem" }}>
          <Check size={48} color="var(--success)" style={{ marginBottom: "1rem" }} />
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>You're all set!</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            Created {result.created} maintenance task{result.created !== 1 && "s"}
            {result.skipped > 0 && ` (${result.skipped} already existed)`}.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <Home size={40} color="var(--accent)" style={{ marginBottom: "0.75rem" }} />
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Set Up Your Home</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Select what your home has and we'll create the right maintenance tasks for you.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {features.map((f) => {
          const isSelected = selected.has(f.id);
          return (
            <div
              key={f.id}
              className="card"
              onClick={() => toggle(f.id)}
              style={{
                cursor: f.locked ? "default" : "pointer",
                padding: "0.875rem 1rem",
                borderColor: isSelected ? "var(--accent)" : "var(--border)",
                background: isSelected ? "rgba(59, 130, 246, 0.05)" : "var(--surface)",
                opacity: f.locked ? 0.8 : 1,
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  background: isSelected ? "var(--accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {isSelected && <Check size={14} color="white" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                    {f.label}
                    {f.locked && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>always included</span>}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{f.description}</div>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", flexShrink: 0 }}>
                  {f.task_count} task{f.task_count !== 1 && "s"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {totalTasks} tasks will be created
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>Skip</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Tasks"}
          </button>
        </div>
      </div>
    </div>
  );
}
