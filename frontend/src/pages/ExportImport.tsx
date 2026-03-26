import { useState, useRef } from "react";
import { Download, Upload, FileSpreadsheet, Printer } from "lucide-react";
import { exportJSON, importJSON, exportCSV, exportPDFReport, type ImportSummary } from "../api";

export default function ExportImport() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      const result = await importJSON(data);
      setImportResult(result);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const entityLabels: Record<string, string> = {
    tasks: "Tasks",
    task_completions: "Completions",
    assets: "Assets",
    contractors: "Contractors",
    repairs: "Repairs",
    documents: "Documents",
    supplies: "Supplies",
  };

  return (
    <div>
      <div className="page-header">
        <h1>Import / Export &amp; Backup</h1>
      </div>

      {/* Export Section */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3>Export Data</h3>

        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "var(--text)" }}>Full Backup</h4>
          <button className="btn btn-primary" onClick={() => exportJSON()}>
            <Download size={16} /> Download JSON Backup
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "var(--text)" }}>CSV Exports</h4>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => exportCSV("tasks")}>
              <FileSpreadsheet size={16} /> Tasks
            </button>
            <button className="btn btn-ghost" onClick={() => exportCSV("completions")}>
              <FileSpreadsheet size={16} /> Completions
            </button>
            <button className="btn btn-ghost" onClick={() => exportCSV("assets")}>
              <FileSpreadsheet size={16} /> Assets
            </button>
            <button className="btn btn-ghost" onClick={() => exportCSV("repairs")}>
              <FileSpreadsheet size={16} /> Repairs
            </button>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "var(--text)" }}>Printable Report</h4>
          <button className="btn btn-ghost" onClick={() => exportPDFReport()}>
            <Printer size={16} /> Print Report (PDF)
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="card">
        <h3>Import Data</h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
          Restore from a JSON backup file. Existing records will not be overwritten.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] || null);
                setImportResult(null);
                setImportError("");
              }}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={!selectedFile || importing}
            onClick={handleImport}
          >
            <Upload size={16} /> {importing ? "Importing..." : "Import"}
          </button>
        </div>

        {importError && (
          <div style={{
            padding: "0.75rem 1rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            color: "var(--danger)",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}>
            {importError}
          </div>
        )}

        {importResult && (
          <div style={{
            padding: "1rem",
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            borderRadius: "6px",
            fontSize: "0.875rem",
          }}>
            <div style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--success)" }}>
              Import Complete
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.25rem 0.5rem", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>Entity</th>
                  <th style={{ textAlign: "right", padding: "0.25rem 0.5rem", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>Created</th>
                  <th style={{ textAlign: "right", padding: "0.25rem 0.5rem", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem" }}>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(entityLabels).map((key) => (
                  <tr key={key}>
                    <td style={{ padding: "0.25rem 0.5rem" }}>{entityLabels[key]}</td>
                    <td style={{ textAlign: "right", padding: "0.25rem 0.5rem", color: "var(--success)" }}>
                      {importResult.imported[key] ?? 0}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.25rem 0.5rem", color: "var(--text-muted)" }}>
                      {importResult.skipped[key] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
