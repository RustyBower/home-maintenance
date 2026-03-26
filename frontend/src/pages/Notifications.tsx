import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, Send, Eye, Zap, Mail, Globe, Radio } from "lucide-react";
import {
  fetchChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  testChannel,
  previewDigest,
  sendDigest,
  CHANNEL_TYPES,
  PRIORITY_COLORS,
  type NotificationChannel,
  type DigestPreview,
} from "../api";

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  webhook: Globe,
  ntfy: Radio,
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "#3b82f6",
  webhook: "#8b5cf6",
  ntfy: "#22c55e",
};

function defaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case "email":
      return { to: "", smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_user: "", smtp_pass: "", use_tls: true };
    case "webhook":
      return { url: "", method: "POST", headers: {} };
    case "ntfy":
      return { server: "https://ntfy.sh", topic: "" };
    default:
      return {};
  }
}

interface ChannelFormData {
  name: string;
  channel_type: "email" | "webhook" | "ntfy";
  enabled: boolean;
  config: Record<string, unknown>;
  notify_overdue: boolean;
  notify_due_today: boolean;
  notify_upcoming_days: number;
}

function emptyForm(): ChannelFormData {
  return {
    name: "",
    channel_type: "ntfy",
    enabled: true,
    config: defaultConfig("ntfy"),
    notify_overdue: true,
    notify_due_today: true,
    notify_upcoming_days: 7,
  };
}

function HeaderEntry({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
      <input
        style={{ flex: 1, padding: "0.375rem 0.5rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)", fontSize: "0.8125rem" }}
        placeholder="Header name"
        value={label}
        readOnly
      />
      <input
        style={{ flex: 2, padding: "0.375rem 0.5rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)", fontSize: "0.8125rem" }}
        placeholder="Value"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ConfigFields({ type, config, onChange }: { type: string; config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val });

  if (type === "email") {
    return (
      <>
        <div className="form-group">
          <label>To Address</label>
          <input type="email" value={(config.to as string) || ""} onChange={(e) => set("to", e.target.value)} placeholder="user@example.com" />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>SMTP Host</label>
            <input value={(config.smtp_host as string) || ""} onChange={(e) => set("smtp_host", e.target.value)} />
          </div>
          <div className="form-group">
            <label>SMTP Port</label>
            <input type="number" value={(config.smtp_port as number) || 587} onChange={(e) => set("smtp_port", parseInt(e.target.value) || 587)} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>SMTP User</label>
            <input value={(config.smtp_user as string) || ""} onChange={(e) => set("smtp_user", e.target.value)} />
          </div>
          <div className="form-group">
            <label>SMTP Password</label>
            <input type="password" value={(config.smtp_pass as string) || ""} onChange={(e) => set("smtp_pass", e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="checkbox">
            <input type="checkbox" checked={config.use_tls !== false} onChange={(e) => set("use_tls", e.target.checked)} />
            Use TLS
          </label>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "-0.5rem" }}>
          Note: SMTP credentials are stored in the database.
        </p>
      </>
    );
  }

  if (type === "webhook") {
    const headers = (config.headers as Record<string, string>) || {};
    const [newHeaderKey, setNewHeaderKey] = useState("");
    return (
      <>
        <div className="form-group">
          <label>Webhook URL</label>
          <input value={(config.url as string) || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
        </div>
        <div className="form-group">
          <label>Method</label>
          <select value={(config.method as string) || "POST"} onChange={(e) => set("method", e.target.value)}>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>
        </div>
        <div className="form-group">
          <label>Custom Headers</label>
          {Object.entries(headers).map(([k, v]) => (
            <HeaderEntry key={k} label={k} value={v} onChange={(val) => {
              const h = { ...headers, [k]: val };
              set("headers", h);
            }} />
          ))}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
            <input
              style={{ flex: 1, padding: "0.375rem 0.5rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)", fontSize: "0.8125rem" }}
              placeholder="New header name"
              value={newHeaderKey}
              onChange={(e) => setNewHeaderKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newHeaderKey.trim()) {
                  set("headers", { ...headers, [newHeaderKey.trim()]: "" });
                  setNewHeaderKey("");
                }
              }}
            />
            <button className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }} onClick={() => {
              if (newHeaderKey.trim()) {
                set("headers", { ...headers, [newHeaderKey.trim()]: "" });
                setNewHeaderKey("");
              }
            }}>Add</button>
          </div>
        </div>
      </>
    );
  }

  if (type === "ntfy") {
    return (
      <>
        <div className="form-group">
          <label>Server URL</label>
          <input value={(config.server as string) || "https://ntfy.sh"} onChange={(e) => set("server", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Topic</label>
          <input value={(config.topic as string) || ""} onChange={(e) => set("topic", e.target.value)} placeholder="home-maintenance" />
        </div>
      </>
    );
  }

  return null;
}

function ChannelModal({ initial, onSave, onClose }: {
  initial: ChannelFormData;
  onSave: (data: ChannelFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ChannelFormData>(initial);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "500px", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3>{initial.name ? "Edit Channel" : "Add Channel"}</h3>

        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g. "My Email", "Discord", "ntfy phone"' />
        </div>

        <div className="form-group">
          <label>Channel Type</label>
          <select value={form.channel_type} onChange={(e) => {
            const ct = e.target.value as ChannelFormData["channel_type"];
            setForm({ ...form, channel_type: ct, config: defaultConfig(ct) });
          }}>
            {CHANNEL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", margin: "0.75rem 0", paddingTop: "0.75rem" }}>
          <ConfigFields type={form.channel_type} config={form.config} onChange={(config) => setForm({ ...form, config })} />
        </div>

        <div style={{ borderTop: "1px solid var(--border)", margin: "0.75rem 0", paddingTop: "0.75rem" }}>
          <div className="form-group">
            <label className="checkbox">
              <input type="checkbox" checked={form.notify_overdue} onChange={(e) => setForm({ ...form, notify_overdue: e.target.checked })} />
              Notify overdue tasks
            </label>
          </div>
          <div className="form-group">
            <label className="checkbox">
              <input type="checkbox" checked={form.notify_due_today} onChange={(e) => setForm({ ...form, notify_due_today: e.target.checked })} />
              Notify tasks due today
            </label>
          </div>
          <div className="form-group">
            <label>Upcoming days (0 to disable)</label>
            <input type="number" min={0} max={90} value={form.notify_upcoming_days} onChange={(e) => setForm({ ...form, notify_upcoming_days: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="checkbox">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Enabled
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ preview, onClose }: { preview: DigestPreview; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "550px", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3>Digest Preview</h3>

        {preview.total_overdue === 0 && preview.total_due_today === 0 && preview.total_upcoming === 0 ? (
          <div className="empty">No tasks to include in digest</div>
        ) : (
          <>
            {preview.overdue.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Overdue ({preview.total_overdue})</h4>
                {preview.overdue.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.8125rem" }}>
                    <span className="cat-dot" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }} />
                    <span>{t.name}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{t.next_due}</span>
                  </div>
                ))}
              </div>
            )}
            {preview.due_today.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ color: "var(--warning)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Due Today ({preview.total_due_today})</h4>
                {preview.due_today.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.8125rem" }}>
                    <span className="cat-dot" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }} />
                    <span>{t.name}</span>
                  </div>
                ))}
              </div>
            )}
            {preview.upcoming.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ color: "var(--accent)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Upcoming ({preview.total_upcoming})</h4>
                {preview.upcoming.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.8125rem" }}>
                    <span className="cat-dot" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }} />
                    <span>{t.name}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{t.next_due}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [editing, setEditing] = useState<ChannelFormData | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchChannels().then(setChannels).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  async function handleSave(data: ChannelFormData) {
    try {
      if (editId !== null) {
        await updateChannel(editId, data);
        showToast("Channel updated");
      } else {
        await createChannel(data);
        showToast("Channel created");
      }
      setEditing(null);
      setEditId(null);
      load();
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this notification channel?")) return;
    await deleteChannel(id);
    showToast("Channel deleted");
    load();
  }

  async function handleTest(ch: NotificationChannel) {
    try {
      const res = await testChannel(ch.id);
      showToast(res.message || "Test sent!");
    } catch (e: unknown) {
      showToast(`Test failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async function handleToggle(ch: NotificationChannel) {
    await updateChannel(ch.id, { enabled: !ch.enabled });
    load();
  }

  async function handlePreview() {
    try {
      const p = await previewDigest();
      setPreview(p);
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async function handleSendNow() {
    if (!confirm("Send digest to all enabled channels now?")) return;
    try {
      const res = await sendDigest();
      const summary = res.results.map((r) => `${r.channel}: ${r.status}`).join(", ");
      showToast(summary || "Digest sent");
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  function openEdit(ch: NotificationChannel) {
    setEditId(ch.id);
    setEditing({
      name: ch.name,
      channel_type: ch.channel_type,
      enabled: ch.enabled,
      config: ch.config,
      notify_overdue: ch.notify_overdue,
      notify_due_today: ch.notify_due_today,
      notify_upcoming_days: ch.notify_upcoming_days,
    });
  }

  if (loading && channels.length === 0) return <div className="empty">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1><Bell size={24} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />Notifications</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-ghost" onClick={handlePreview}>
            <Eye size={16} /> Preview Digest
          </button>
          <button className="btn btn-primary" onClick={handleSendNow}>
            <Send size={16} /> Send Now
          </button>
          <button className="btn btn-success" onClick={() => { setEditId(null); setEditing(emptyForm()); }}>
            <Plus size={16} /> Add Channel
          </button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="card">
          <div className="empty">
            No notification channels configured yet. Add one to get started.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {channels.map((ch) => {
            const Icon = CHANNEL_ICONS[ch.channel_type] || Bell;
            return (
              <div key={ch.id} className="card" style={{ opacity: ch.enabled ? 1 : 0.6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      onClick={() => handleToggle(ch)}
                      style={{
                        width: "36px", height: "20px", borderRadius: "10px", border: "none", cursor: "pointer",
                        background: ch.enabled ? "var(--success)" : "var(--border)",
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: "2px", width: "16px", height: "16px", borderRadius: "50%",
                        background: "white", transition: "left 0.2s",
                        left: ch.enabled ? "18px" : "2px",
                      }} />
                    </button>
                    <Icon size={18} color={CHANNEL_COLORS[ch.channel_type]} />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{ch.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", marginTop: "0.125rem" }}>
                        <span className="badge" style={{ background: `${CHANNEL_COLORS[ch.channel_type]}22`, color: CHANNEL_COLORS[ch.channel_type] }}>
                          {ch.channel_type}
                        </span>
                        {ch.notify_overdue && <span className="badge badge-overdue">overdue</span>}
                        {ch.notify_due_today && <span className="badge badge-due-today">due today</span>}
                        {ch.notify_upcoming_days > 0 && <span className="badge badge-upcoming">{ch.notify_upcoming_days}d ahead</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleTest(ch)}>
                      <Zap size={14} /> Test
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => openEdit(ch)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleDelete(ch.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <ChannelModal initial={editing} onSave={handleSave} onClose={() => { setEditing(null); setEditId(null); }} />}
      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}

      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "8px", padding: "0.75rem 1.25rem",
          fontSize: "0.875rem", zIndex: 200, maxWidth: "400px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
