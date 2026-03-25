import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSupplies, fetchTasks, createSupply, updateSupply, type Supply, type Task } from "../api";
import { AlertTriangle, Package, Plus } from "lucide-react";

export default function Supplies() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [qty, setQty] = useState("0");
  const [perUse, setPerUse] = useState("1");

  const load = () => { fetchSupplies({ low_stock: showLowStock || undefined }).then(setSupplies); };
  useEffect(() => { load(); }, [showLowStock]);

  async function handleUpdateQty(supply: Supply, delta: number) {
    const newQty = Math.max(0, supply.quantity_on_hand + delta);
    await updateSupply(supply.id, { quantity_on_hand: newQty });
    load();
  }

  function openAdd() {
    if (tasks.length === 0) fetchTasks().then(setTasks);
    setShowAdd(true);
  }

  async function handleAdd() {
    if (!taskId || !name) return;
    await createSupply(Number(taskId), {
      name,
      url: url || undefined,
      quantity_on_hand: parseInt(qty) || 0,
      quantity_per_use: parseInt(perUse) || 1,
    });
    setShowAdd(false);
    setTaskId(""); setName(""); setUrl(""); setQty("0"); setPerUse("1");
    load();
  }

  const lowStockCount = supplies.filter((s) => s.quantity_on_hand <= s.quantity_per_use).length;

  return (
    <div>
      <div className="page-header">
        <h1><Package size={24} style={{ verticalAlign: "middle" }} /> Supplies</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Supply</button>
      </div>

      <div className="filters">
        <label className="checkbox" style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          <input type="checkbox" checked={showLowStock} onChange={(e) => setShowLowStock(e.target.checked)} />
          Low stock only
        </label>
        {lowStockCount > 0 && !showLowStock && (
          <span className="badge badge-overdue">
            <AlertTriangle size={12} /> {lowStockCount} low stock
          </span>
        )}
        <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
          {supplies.length} item{supplies.length !== 1 && "s"}
        </span>
      </div>

      {supplies.length === 0 ? (
        <div className="card">
          <div className="empty">
            {showLowStock ? "No low stock items." : "No supplies tracked yet."}
          </div>
        </div>
      ) : (
        <div className="card">
          {supplies.map((s) => {
            const isLow = s.quantity_on_hand <= s.quantity_per_use;
            return (
              <div key={s.id} className="task-item">
                <div className="task-info">
                  <span className="task-name">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{s.name}</a>
                    ) : s.name}
                  </span>
                  <Link to={`/tasks/${s.task_id}`} style={{ fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "none" }}>
                    {tasks.find((t) => t.id === s.task_id)?.name || `Task #${s.task_id}`}
                  </Link>
                </div>
                <div className="task-meta">
                  {isLow && <span className="badge badge-overdue"><AlertTriangle size={11} /> Low</span>}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <button className="btn btn-ghost" style={{ padding: "0.15rem 0.35rem", fontSize: "0.75rem" }} onClick={() => handleUpdateQty(s, -1)}>-</button>
                    <span style={{ minWidth: "2rem", textAlign: "center", fontSize: "0.9rem", fontWeight: 600, color: isLow ? "var(--danger)" : "var(--text)" }}>
                      {s.quantity_on_hand}
                    </span>
                    <button className="btn btn-ghost" style={{ padding: "0.15rem 0.35rem", fontSize: "0.75rem" }} onClick={() => handleUpdateQty(s, 1)}>+</button>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>/{s.quantity_per_use} per use</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Supply</h3>
            <div className="form-group">
              <label>Task</label>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Select a task...</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Supply Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HVAC Filter 20x25x1" />
            </div>
            <div className="form-group">
              <label>Link (optional)</label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://amazon.com/..." />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Quantity On Hand</label>
                <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Qty Per Use</label>
                <input type="number" value={perUse} onChange={(e) => setPerUse(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add Supply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
