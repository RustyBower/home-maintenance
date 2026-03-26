import { useEffect, useState } from "react";
import {
  Plus,
  Play,
  Pencil,
  Trash2,
  Check,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  X,
  ClipboardList,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Local interfaces (avoid modifying shared api.ts)
// ---------------------------------------------------------------------------

const API_BASE = "/api";

interface ChecklistItem {
  name: string;
  description: string | null;
  order: number;
}

interface ChecklistItemState extends ChecklistItem {
  checked: boolean;
  checked_at: string | null;
}

interface ChecklistTemplate {
  id: number;
  name: string;
  description: string | null;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

interface ChecklistInstance {
  id: number;
  template_id: number | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  items_state: ChecklistItemState[];
  notes: string | null;
  template_name: string | null;
  checked_count: number;
  total_count: number;
}

// ---------------------------------------------------------------------------
// Local API helpers
// ---------------------------------------------------------------------------

async function fetchTemplates(): Promise<ChecklistTemplate[]> {
  const res = await fetch(`${API_BASE}/checklists/templates`);
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

async function createTemplate(data: {
  name: string;
  description?: string;
  items: ChecklistItem[];
}): Promise<ChecklistTemplate> {
  const res = await fetch(`${API_BASE}/checklists/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create template");
  return res.json();
}

async function updateTemplate(
  id: number,
  data: { name?: string; description?: string; items?: ChecklistItem[] }
): Promise<ChecklistTemplate> {
  const res = await fetch(`${API_BASE}/checklists/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update template");
  return res.json();
}

async function deleteTemplate(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/checklists/templates/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete template");
}

async function startChecklist(
  templateId: number,
  data?: { name?: string }
): Promise<ChecklistInstance> {
  const res = await fetch(
    `${API_BASE}/checklists/templates/${templateId}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    }
  );
  if (!res.ok) throw new Error("Failed to start checklist");
  return res.json();
}

async function fetchInstances(
  status?: string
): Promise<ChecklistInstance[]> {
  const query = status ? `?status=${status}` : "";
  const res = await fetch(`${API_BASE}/checklists/instances${query}`);
  if (!res.ok) throw new Error("Failed to fetch instances");
  return res.json();
}

async function updateInstance(
  id: number,
  data: { name?: string; notes?: string }
): Promise<ChecklistInstance> {
  const res = await fetch(`${API_BASE}/checklists/instances/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update instance");
  return res.json();
}

async function toggleItem(
  instanceId: number,
  itemIndex: number
): Promise<ChecklistInstance> {
  const res = await fetch(
    `${API_BASE}/checklists/instances/${instanceId}/toggle/${itemIndex}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Failed to toggle item");
  return res.json();
}

async function deleteInstance(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/checklists/instances/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete instance");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function progressPct(checked: number, total: number): number {
  return total > 0 ? Math.round((checked / total) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Checklists() {
  const [tab, setTab] = useState<"templates" | "active">("templates");
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplItems, setTplItems] = useState<{ name: string; description: string }[]>([]);

  // Start-checklist modal
  const [startTemplateId, setStartTemplateId] = useState<number | null>(null);
  const [startName, setStartName] = useState("");

  // Expanded instance
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Instance filter
  const [instanceFilter, setInstanceFilter] = useState<"" | "active" | "completed">("");

  const loadTemplates = () => fetchTemplates().then(setTemplates);
  const loadInstances = () =>
    fetchInstances(instanceFilter || undefined).then(setInstances);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    loadInstances();
  }, [instanceFilter]);

  // --- Template modal helpers ---

  function openCreateTemplate() {
    setEditingTemplateId(null);
    setTplName("");
    setTplDesc("");
    setTplItems([{ name: "", description: "" }]);
    setShowTemplateModal(true);
  }

  function openEditTemplate(t: ChecklistTemplate) {
    setEditingTemplateId(t.id);
    setTplName(t.name);
    setTplDesc(t.description || "");
    setTplItems(
      t.items.map((i) => ({
        name: i.name,
        description: i.description || "",
      }))
    );
    setShowTemplateModal(true);
  }

  async function saveTemplate() {
    const items: ChecklistItem[] = tplItems
      .filter((i) => i.name.trim())
      .map((i, idx) => ({
        name: i.name.trim(),
        description: i.description.trim() || null,
        order: idx,
      }));
    if (editingTemplateId) {
      await updateTemplate(editingTemplateId, {
        name: tplName,
        description: tplDesc || undefined,
        items,
      });
    } else {
      await createTemplate({
        name: tplName,
        description: tplDesc || undefined,
        items,
      });
    }
    setShowTemplateModal(false);
    loadTemplates();
  }

  async function handleDeleteTemplate(id: number) {
    if (!confirm("Delete this template and all its instances?")) return;
    await deleteTemplate(id);
    loadTemplates();
  }

  // --- Item editor helpers ---

  function setItemField(
    idx: number,
    field: "name" | "description",
    value: string
  ) {
    setTplItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addItem() {
    setTplItems((prev) => [...prev, { name: "", description: "" }]);
  }

  function removeItem(idx: number) {
    setTplItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setTplItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // --- Start checklist ---

  function openStartChecklist(t: ChecklistTemplate) {
    setStartTemplateId(t.id);
    setStartName(t.name);
  }

  async function handleStartChecklist() {
    if (!startTemplateId) return;
    await startChecklist(startTemplateId, { name: startName });
    setStartTemplateId(null);
    setTab("active");
    loadInstances();
  }

  // --- Instance actions ---

  async function handleToggle(instanceId: number, itemIndex: number) {
    const updated = await toggleItem(instanceId, itemIndex);
    setInstances((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  }

  async function handleSaveNotes(instanceId: number, notes: string) {
    const updated = await updateInstance(instanceId, { notes });
    setInstances((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  }

  async function handleDeleteInstance(id: number) {
    if (!confirm("Delete this checklist?")) return;
    await deleteInstance(id);
    if (expandedId === id) setExpandedId(null);
    loadInstances();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canSaveTemplate = tplName.trim() && tplItems.some((i) => i.name.trim());

  return (
    <div>
      <div className="page-header">
        <h1>Checklists</h1>
        {tab === "templates" && (
          <button className="btn btn-primary" onClick={openCreateTemplate}>
            <Plus size={16} /> Create Template
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="filters">
        <button
          className={`btn ${tab === "templates" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("templates")}
        >
          <ClipboardList size={14} /> Templates
        </button>
        <button
          className={`btn ${tab === "active" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => {
            setTab("active");
            loadInstances();
          }}
        >
          <CheckCircle2 size={14} /> Active Checklists
        </button>
      </div>

      {/* ================================================================= */}
      {/* TEMPLATES TAB                                                      */}
      {/* ================================================================= */}
      {tab === "templates" && (
        <div>
          {templates.length === 0 ? (
            <div className="card">
              <div className="empty">
                <ClipboardList
                  size={24}
                  style={{ marginBottom: "0.5rem", opacity: 0.5 }}
                />
                <div>No templates yet</div>
              </div>
            </div>
          ) : (
            <div className="grid-3">
              {templates.map((t) => (
                <div key={t.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1rem" }}>{t.name}</div>
                      {t.description && (
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-muted)",
                            marginTop: "0.25rem",
                          }}
                        >
                          {t.description}
                        </div>
                      )}
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        color: "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      {t.items.length} items
                    </span>
                  </div>

                  {/* Item preview */}
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    {t.items.slice(0, 4).map((item, idx) => (
                      <div key={idx} style={{ padding: "0.125rem 0" }}>
                        &bull; {item.name}
                      </div>
                    ))}
                    {t.items.length > 4 && (
                      <div style={{ fontStyle: "italic" }}>
                        +{t.items.length - 4} more...
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "auto",
                      borderTop: "1px solid var(--border)",
                      paddingTop: "0.75rem",
                    }}
                  >
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => openStartChecklist(t)}
                    >
                      <Play size={14} /> Start
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.5rem" }}
                      onClick={() => openEditTemplate(t)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "0.5rem" }}
                      onClick={() => handleDeleteTemplate(t.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* ACTIVE CHECKLISTS TAB                                              */}
      {/* ================================================================= */}
      {tab === "active" && (
        <div>
          <div className="filters">
            <select
              value={instanceFilter}
              onChange={(e) =>
                setInstanceFilter(e.target.value as "" | "active" | "completed")
              }
            >
              <option value="">All</option>
              <option value="active">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {instances.length === 0 ? (
            <div className="card">
              <div className="empty">
                <CheckCircle2
                  size={24}
                  style={{ marginBottom: "0.5rem", opacity: 0.5 }}
                />
                <div>No checklists yet. Start one from a template!</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {instances.map((inst) => {
                const pct = progressPct(inst.checked_count, inst.total_count);
                const isExpanded = expandedId === inst.id;
                const isComplete = inst.completed_at !== null;

                return (
                  <div key={inst.id} className="card" style={{ padding: 0 }}>
                    {/* Header row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem 1.25rem",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : inst.id)
                      }
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                        {isComplete ? (
                          <CheckCircle2
                            size={20}
                            style={{ color: "var(--success)", flexShrink: 0 }}
                          />
                        ) : (
                          <ClipboardList
                            size={20}
                            style={{ color: "var(--accent)", flexShrink: 0 }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.9375rem",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {inst.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {inst.template_name && (
                              <span>From: {inst.template_name} &middot; </span>
                            )}
                            Started {formatDate(inst.started_at)}
                            {isComplete &&
                              inst.completed_at &&
                              ` \u00b7 Completed ${formatDate(inst.completed_at)}`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                        {/* Progress bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div
                            style={{
                              width: 100,
                              height: 6,
                              background: "var(--border)",
                              borderRadius: 3,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: isComplete
                                  ? "var(--success)"
                                  : "var(--accent)",
                                borderRadius: 3,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: isComplete
                                ? "var(--success)"
                                : "var(--text-muted)",
                              fontWeight: 500,
                              minWidth: 36,
                            }}
                          >
                            {inst.checked_count}/{inst.total_count}
                          </span>
                        </div>

                        <button
                          className="btn btn-danger"
                          style={{ padding: "0.25rem 0.5rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInstance(inst.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "1rem 1.25rem",
                        }}
                      >
                        {/* Checklist items */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {inst.items_state.map((item, idx) => (
                            <label
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.75rem",
                                padding: "0.5rem 0.75rem",
                                borderRadius: 6,
                                cursor: "pointer",
                                transition: "background 0.15s",
                                background: item.checked
                                  ? "rgba(34,197,94,0.06)"
                                  : "transparent",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.background =
                                  item.checked
                                    ? "rgba(34,197,94,0.1)"
                                    : "var(--surface-hover)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background =
                                  item.checked
                                    ? "rgba(34,197,94,0.06)"
                                    : "transparent";
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() => handleToggle(inst.id, idx)}
                                style={{
                                  marginTop: "0.125rem",
                                  accentColor: "var(--success)",
                                  width: 16,
                                  height: 16,
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: "0.875rem",
                                    textDecoration: item.checked
                                      ? "line-through"
                                      : "none",
                                    opacity: item.checked ? 0.6 : 1,
                                  }}
                                >
                                  {item.name}
                                </div>
                                {item.description && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--text-muted)",
                                      marginTop: "0.125rem",
                                    }}
                                  >
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {item.checked && item.checked_at && (
                                <span
                                  style={{
                                    fontSize: "0.6875rem",
                                    color: "var(--text-muted)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {new Date(item.checked_at).toLocaleString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    }
                                  )}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>

                        {/* Notes */}
                        <div
                          style={{
                            marginTop: "1rem",
                            borderTop: "1px solid var(--border)",
                            paddingTop: "1rem",
                          }}
                        >
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Notes</label>
                            <textarea
                              value={inst.notes || ""}
                              placeholder="Add notes..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setInstances((prev) =>
                                  prev.map((i) =>
                                    i.id === inst.id
                                      ? { ...i, notes: val }
                                      : i
                                  )
                                );
                              }}
                              onBlur={() =>
                                handleSaveNotes(inst.id, inst.notes || "")
                              }
                              style={{ minHeight: 60 }}
                            />
                          </div>
                        </div>

                        {/* Status actions */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "0.5rem",
                            marginTop: "1rem",
                          }}
                        >
                          {isComplete ? (
                            <button
                              className="btn btn-ghost"
                              onClick={() => {
                                // Uncheck last item to reopen
                                const lastChecked = [...inst.items_state]
                                  .reverse()
                                  .findIndex((i) => i.checked);
                                if (lastChecked >= 0) {
                                  const realIdx =
                                    inst.items_state.length - 1 - lastChecked;
                                  handleToggle(inst.id, realIdx);
                                }
                              }}
                            >
                              <RotateCcw size={14} /> Reopen
                            </button>
                          ) : (
                            <button
                              className="btn btn-success"
                              onClick={async () => {
                                // Check all unchecked items
                                for (let i = 0; i < inst.items_state.length; i++) {
                                  if (!inst.items_state[i].checked) {
                                    await handleToggle(inst.id, i);
                                  }
                                }
                              }}
                            >
                              <Check size={14} /> Mark All Complete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TEMPLATE CREATE/EDIT MODAL                                         */}
      {/* ================================================================= */}
      {showTemplateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 560, maxHeight: "90vh", overflowY: "auto" }}
          >
            <h3>
              {editingTemplateId ? "Edit Template" : "Create Template"}
            </h3>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder='e.g. "Leaving for Vacation"'
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                placeholder="What is this checklist for?"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                style={{ minHeight: 60 }}
              />
            </div>

            <div className="form-group">
              <label>Items</label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {tplItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "flex-start",
                      background: "var(--bg)",
                      padding: "0.5rem",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                    }}
                  >
                    {/* Reorder buttons */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.125rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      <button
                        className="btn btn-ghost"
                        style={{
                          padding: "0.125rem",
                          border: "none",
                          opacity: idx === 0 ? 0.3 : 1,
                        }}
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        title="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{
                          padding: "0.125rem",
                          border: "none",
                          opacity:
                            idx === tplItems.length - 1 ? 0.3 : 1,
                        }}
                        disabled={idx === tplItems.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        title="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    {/* Item fields */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <input
                        type="text"
                        placeholder={`Item ${idx + 1}`}
                        value={item.name}
                        onChange={(e) =>
                          setItemField(idx, "name", e.target.value)
                        }
                        style={{
                          padding: "0.375rem 0.5rem",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          color: "var(--text)",
                          fontSize: "0.875rem",
                          width: "100%",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={item.description}
                        onChange={(e) =>
                          setItemField(idx, "description", e.target.value)
                        }
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          color: "var(--text-muted)",
                          fontSize: "0.75rem",
                          width: "100%",
                        }}
                      />
                    </div>

                    {/* Delete button */}
                    <button
                      className="btn btn-ghost"
                      style={{
                        padding: "0.25rem",
                        border: "none",
                        color: "var(--danger)",
                        marginTop: "0.25rem",
                      }}
                      onClick={() => removeItem(idx)}
                      title="Remove item"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-ghost"
                style={{ marginTop: "0.5rem" }}
                onClick={addItem}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveTemplate}
                disabled={!canSaveTemplate}
              >
                {editingTemplateId ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* START CHECKLIST MODAL                                              */}
      {/* ================================================================= */}
      {startTemplateId !== null && (
        <div
          className="modal-overlay"
          onClick={() => setStartTemplateId(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 400 }}
          >
            <h3>Start Checklist</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={startName}
                onChange={(e) => setStartName(e.target.value)}
                placeholder="e.g. Vacation Jan 2026"
              />
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.25rem",
                }}
              >
                Customize the name or keep the template default.
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setStartTemplateId(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleStartChecklist}
              >
                <Play size={14} /> Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
