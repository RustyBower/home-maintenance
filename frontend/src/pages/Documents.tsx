import { useEffect, useState, useRef } from "react";
import { Plus, FileText, ExternalLink, Pencil, Trash2, Upload, Paperclip, Download, X, Eye } from "lucide-react";
import {
  fetchDocuments, createDocument, updateDocument, deleteDocument,
  uploadDocument, uploadDocumentFile, downloadDocumentUrl, createDocumentFromUrl,
  formatFileSize,
  fetchAssets, fetchTasks,
  DOC_TYPES, DOC_TYPE_COLORS, EXPIRY_STATUS_COLORS,
  type Document, type Asset, type Task,
} from "../api";

interface Repair {
  id: number;
  title: string;
}

const API_BASE = "/api";

async function fetchRepairsList(): Promise<Repair[]> {
  const res = await fetch(`${API_BASE}/repairs`);
  if (!res.ok) throw new Error("Failed to fetch repairs");
  return res.json();
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EXPIRY_LABELS: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  unknown: "No Expiry",
};

const emptyForm = {
  name: "",
  doc_type: "manual",
  url: "",
  asset_id: "",
  task_id: "",
  repair_id: "",
  expiry_date: "",
  notes: "",
};

function isImageMime(mime: string | null): boolean {
  if (!mime) return false;
  return /^image\/(jpeg|jpg|png|gif|webp|svg)/.test(mime);
}

function isPdfMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime === "application/pdf";
}

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachingDocId, setAttachingDocId] = useState<number | null>(null);
  const [saveLocally, setSaveLocally] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveWarning, setSaveWarning] = useState("");

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = () => {
    fetchDocuments({ doc_type: filterType || undefined }).then(setDocs);
  };

  useEffect(() => {
    load();
    fetchAssets().then(setAssets);
    fetchTasks().then(setTasks);
    fetchRepairsList().then(setRepairs);
  }, [filterType]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setSelectedFile(null);
    setSaveLocally(true);
    setSaveWarning("");
    setShowModal(true);
  }

  function openEdit(doc: Document) {
    setEditingId(doc.id);
    setForm({
      name: doc.name,
      doc_type: doc.doc_type,
      url: doc.url || "",
      asset_id: doc.asset_id?.toString() || "",
      task_id: doc.task_id?.toString() || "",
      repair_id: doc.repair_id?.toString() || "",
      expiry_date: doc.expiry_date || "",
      notes: doc.notes || "",
    });
    setSelectedFile(null);
    setSaveLocally(true);
    setSaveWarning("");
    setShowModal(true);
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    if (!form.name) {
      setForm((f) => ({ ...f, name: file.name }));
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveWarning("");
    try {
      if (!editingId && selectedFile) {
        // Upload with file
        await uploadDocument(selectedFile, {
          name: form.name || undefined,
          doc_type: form.doc_type,
          asset_id: form.asset_id ? parseInt(form.asset_id) : undefined,
          task_id: form.task_id ? parseInt(form.task_id) : undefined,
          repair_id: form.repair_id ? parseInt(form.repair_id) : undefined,
          expiry_date: form.expiry_date || undefined,
          notes: form.notes || undefined,
        });
      } else if (!editingId && !selectedFile && form.url && saveLocally) {
        // Create from URL with local download
        try {
          await createDocumentFromUrl({
            url: form.url,
            name: form.name || undefined,
            doc_type: form.doc_type,
            asset_id: form.asset_id ? parseInt(form.asset_id) : undefined,
            task_id: form.task_id ? parseInt(form.task_id) : undefined,
            repair_id: form.repair_id ? parseInt(form.repair_id) : undefined,
            expiry_date: form.expiry_date || undefined,
            notes: form.notes || undefined,
          });
        } catch {
          // Download failed - fall back to creating with just the URL
          setSaveWarning("Download failed. Document created with URL only.");
          const payload: Record<string, unknown> = {
            name: form.name,
            doc_type: form.doc_type,
            url: form.url || null,
            asset_id: form.asset_id ? parseInt(form.asset_id) : null,
            task_id: form.task_id ? parseInt(form.task_id) : null,
            repair_id: form.repair_id ? parseInt(form.repair_id) : null,
            expiry_date: form.expiry_date || null,
            notes: form.notes || null,
          };
          await createDocument(payload as Parameters<typeof createDocument>[0]);
        }
      } else if (editingId) {
        const payload: Record<string, unknown> = {
          name: form.name,
          doc_type: form.doc_type,
          url: form.url || null,
          asset_id: form.asset_id ? parseInt(form.asset_id) : null,
          task_id: form.task_id ? parseInt(form.task_id) : null,
          repair_id: form.repair_id ? parseInt(form.repair_id) : null,
          expiry_date: form.expiry_date || null,
          notes: form.notes || null,
        };
        await updateDocument(editingId, payload as Partial<Document>);
        if (selectedFile) {
          await uploadDocumentFile(editingId, selectedFile);
        }
      } else {
        // URL-only create
        const payload: Record<string, unknown> = {
          name: form.name,
          doc_type: form.doc_type,
          url: form.url || null,
          asset_id: form.asset_id ? parseInt(form.asset_id) : null,
          task_id: form.task_id ? parseInt(form.task_id) : null,
          repair_id: form.repair_id ? parseInt(form.repair_id) : null,
          expiry_date: form.expiry_date || null,
          notes: form.notes || null,
        };
        await createDocument(payload as Parameters<typeof createDocument>[0]);
      }
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
    load();
  }

  async function handleAttachFile(docId: number, file: File) {
    await uploadDocumentFile(docId, file);
    load();
  }

  async function handleDownloadUrl(doc: Document) {
    setDownloading(true);
    try {
      const updated = await downloadDocumentUrl(doc.id);
      setPreviewDoc(updated);
      load();
    } catch {
      alert("Failed to download file from URL.");
    } finally {
      setDownloading(false);
    }
  }

  function linkedEntity(doc: Document): string | null {
    if (doc.asset_id) {
      const a = assets.find((x) => x.id === doc.asset_id);
      return a ? `Asset: ${a.name}` : "Asset #" + doc.asset_id;
    }
    if (doc.task_id) {
      const t = tasks.find((x) => x.id === doc.task_id);
      return t ? `Task: ${t.name}` : "Task #" + doc.task_id;
    }
    if (doc.repair_id) {
      const r = repairs.find((x) => x.id === doc.repair_id);
      return r ? `Repair: ${r.title}` : "Repair #" + doc.repair_id;
    }
    return null;
  }

  // Sort: expired/expiring first, then by name
  const sorted = [...docs].sort((a, b) => {
    const order: Record<string, number> = { expired: 0, expiring_soon: 1, active: 2, unknown: 3 };
    const oa = order[a.expiry_status] ?? 3;
    const ob = order[b.expiry_status] ?? 3;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  const canSave = form.name && (form.url || selectedFile);

  // Whether the create form should show the "save locally" toggle
  const showSaveLocallyToggle = !editingId && !selectedFile && !!form.url;

  return (
    <div>
      <div className="page-header">
        <h1>Documents</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Document
        </button>
      </div>

      <div className="filters">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Hidden input for attaching files to existing docs */}
      <input
        ref={attachInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && attachingDocId !== null) {
            handleAttachFile(attachingDocId, file);
          }
          e.target.value = "";
          setAttachingDocId(null);
        }}
      />

      <div className="card">
        {sorted.length === 0 ? (
          <div className="empty">
            <FileText size={24} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
            <div>No documents yet</div>
          </div>
        ) : (
          sorted.map((doc) => {
            const typeLabel = DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ?? doc.doc_type;
            const linked = linkedEntity(doc);
            return (
              <div key={doc.id} className="task-item" style={{ cursor: "default" }}>
                <div className="task-info">
                  <span
                    className="cat-dot"
                    style={{ backgroundColor: DOC_TYPE_COLORS[doc.doc_type] }}
                  />
                  <span
                    className="task-name"
                    style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={() => setPreviewDoc(doc)}
                  >
                    {doc.name} <Eye size={12} style={{ verticalAlign: "middle", opacity: 0.6 }} />
                  </span>
                </div>
                <div className="task-meta">
                  <span
                    className="badge badge-category"
                    style={{ backgroundColor: DOC_TYPE_COLORS[doc.doc_type] }}
                  >
                    {typeLabel}
                  </span>
                  {doc.file_size != null && (
                    <span
                      className="badge"
                      style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}
                    >
                      <Paperclip size={10} /> {formatFileSize(doc.file_size)}
                    </span>
                  )}
                  {linked && (
                    <span
                      className="badge"
                      style={{ background: "rgba(113,113,122,0.15)", color: "var(--text-muted)" }}
                    >
                      {linked}
                    </span>
                  )}
                  <span
                    className="badge"
                    style={{
                      backgroundColor: EXPIRY_STATUS_COLORS[doc.expiry_status] + "22",
                      color: EXPIRY_STATUS_COLORS[doc.expiry_status],
                    }}
                  >
                    {EXPIRY_LABELS[doc.expiry_status]}
                  </span>
                  {doc.expiry_date && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatDate(doc.expiry_date)}
                    </span>
                  )}
                  {!doc.file_path && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.25rem 0.5rem" }}
                      title="Attach file"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttachingDocId(doc.id);
                        attachInputRef.current?.click();
                      }}
                    >
                      <Upload size={14} />
                    </button>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "0.25rem 0.5rem" }}
                    onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: "0.25rem 0.5rem" }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{editingId ? "Edit Document" : "Add Document"}</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder='e.g. "Carrier AC Manual"'
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label>Upload File</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: "1rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(59,130,246,0.06)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = "";
                  }}
                />
                {selectedFile ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <Paperclip size={16} style={{ color: "var(--accent)" }} />
                    <span style={{ color: "var(--text)" }}>{selectedFile.name}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                      ({formatFileSize(selectedFile.size)})
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.125rem 0.375rem", fontSize: "0.75rem" }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    <Upload size={20} style={{ marginBottom: "0.25rem", opacity: 0.5 }} />
                    <div>Drop a file here or click to browse</div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>URL {selectedFile ? "(optional)" : ""}</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
              {!selectedFile && !form.url && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Provide a URL, upload a file, or both
                </div>
              )}
            </div>

            {showSaveLocallyToggle && (
              <div className="form-group">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={saveLocally}
                    onChange={(e) => setSaveLocally(e.target.checked)}
                  />
                  Save file locally (download from URL)
                </label>
                {saveLocally && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    The file will be downloaded and stored on the server
                  </div>
                )}
              </div>
            )}

            {saveWarning && (
              <div style={{
                fontSize: "0.8125rem",
                color: "var(--warning)",
                background: "rgba(245,158,11,0.1)",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                marginBottom: "1rem",
              }}>
                {saveWarning}
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label>Document Type</label>
                <select value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))}>
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Asset (optional)</label>
                <select value={form.asset_id} onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}>
                  <option value="">None</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Task (optional)</label>
                <select value={form.task_id} onChange={(e) => setForm((f) => ({ ...f, task_id: e.target.value }))}>
                  <option value="">None</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Repair (optional)</label>
              <select value={form.repair_id} onChange={(e) => setForm((f) => ({ ...f, repair_id: e.target.value }))}>
                <option value="">None</option>
                {repairs.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? (saveLocally && form.url && !selectedFile ? "Downloading..." : "Saving...") : (editingId ? "Save Changes" : "Add Document")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal-preview" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-preview-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                <span
                  className="badge badge-category"
                  style={{ backgroundColor: DOC_TYPE_COLORS[previewDoc.doc_type], flexShrink: 0 }}
                >
                  {DOC_TYPES.find((t) => t.value === previewDoc.doc_type)?.label ?? previewDoc.doc_type}
                </span>
                <span style={{ fontSize: "1rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {previewDoc.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                {previewDoc.file_url && (
                  <>
                    <a
                      href={previewDoc.file_url}
                      download
                      className="btn btn-ghost"
                      style={{ padding: "0.375rem 0.75rem", textDecoration: "none" }}
                    >
                      <Download size={14} /> Download
                    </a>
                    <a
                      href={previewDoc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                      style={{ padding: "0.375rem 0.75rem", textDecoration: "none" }}
                    >
                      <ExternalLink size={14} /> Open in New Tab
                    </a>
                  </>
                )}
                {previewDoc.url && !previewDoc.file_url && (
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ padding: "0.375rem 0.75rem", textDecoration: "none" }}
                  >
                    <ExternalLink size={14} /> Open URL
                  </a>
                )}
                <button className="btn btn-ghost" style={{ padding: "0.375rem" }} onClick={() => setPreviewDoc(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="modal-preview-body">
              {previewDoc.file_url && isPdfMime(previewDoc.mime_type) ? (
                <iframe
                  src={previewDoc.file_url}
                  style={{ width: "100%", height: "100%", border: "none", borderRadius: 4 }}
                  title={previewDoc.name}
                />
              ) : previewDoc.file_url && isImageMime(previewDoc.mime_type) ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", overflow: "auto" }}>
                  <img
                    src={previewDoc.file_url}
                    alt={previewDoc.name}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 4 }}
                  />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1.5rem" }}>
                  <FileText size={48} style={{ opacity: 0.3 }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.125rem", fontWeight: 500, marginBottom: "0.5rem" }}>{previewDoc.name}</div>
                    {previewDoc.mime_type && (
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Type: {previewDoc.mime_type}</div>
                    )}
                    {previewDoc.file_size != null && (
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Size: {formatFileSize(previewDoc.file_size)}</div>
                    )}
                  </div>

                  {/* If no local file but has URL, show download button */}
                  {!previewDoc.file_url && previewDoc.url && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                        This document links to an external URL. Download it to preview or view locally.
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleDownloadUrl(previewDoc)}
                        disabled={downloading}
                      >
                        <Download size={14} /> {downloading ? "Downloading..." : "Download & Save Locally"}
                      </button>
                    </div>
                  )}

                  {previewDoc.file_url && (
                    <a
                      href={previewDoc.file_url}
                      download
                      className="btn btn-primary"
                      style={{ textDecoration: "none" }}
                    >
                      <Download size={14} /> Download File
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Metadata footer */}
            <div className="modal-preview-footer">
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <span
                  className="badge"
                  style={{
                    backgroundColor: EXPIRY_STATUS_COLORS[previewDoc.expiry_status] + "22",
                    color: EXPIRY_STATUS_COLORS[previewDoc.expiry_status],
                  }}
                >
                  {EXPIRY_LABELS[previewDoc.expiry_status]}
                </span>
                {previewDoc.expiry_date && (
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Expires: {formatDate(previewDoc.expiry_date)}
                  </span>
                )}
                {linkedEntity(previewDoc) && (
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    {linkedEntity(previewDoc)}
                  </span>
                )}
                {previewDoc.url && (
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "0.8125rem", color: "var(--accent)", textDecoration: "none" }}
                  >
                    Source URL <ExternalLink size={10} style={{ verticalAlign: "middle" }} />
                  </a>
                )}
              </div>
              {previewDoc.notes && (
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  {previewDoc.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
