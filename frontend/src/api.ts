const API_BASE = "/api";

export interface Task {
  id: number;
  name: string;
  description: string | null;
  category: string;
  frequency: string;
  season: string | null;
  priority: string;
  estimated_minutes: number | null;
  prefer_weekend: boolean;
  custom_interval_days: number | null;
  next_due: string | null;
  asset_id: number | null;
  created_at: string;
  updated_at: string;
  last_completed: string | null;
}

export interface TaskCompletion {
  id: number;
  task_id: number;
  completed_at: string;
  notes: string | null;
  cost: number | null;
  photo_url: string | null;
  duration_minutes: number | null;
  contractor_id: number | null;
}

export interface Supply {
  id: number;
  task_id: number;
  name: string;
  url: string | null;
  quantity_on_hand: number;
  quantity_per_use: number;
  annual_uses: number | null;
  notes: string | null;
}

export interface TaskWithHistory extends Task {
  completions: TaskCompletion[];
  supplies: Supply[];
}

export interface Dashboard {
  overdue: Task[];
  due_today: Task[];
  upcoming: Task[];
  recent_completions: TaskCompletion[];
  overdue_by_category: Record<string, number>;
  time_estimates: {
    overdue_minutes: number;
    today_minutes: number;
    upcoming_minutes: number;
  };
}

export interface WeekendPlan {
  weekend_date: string;
  tasks: Task[];
  total_tasks: number;
  total_minutes: number;
  by_priority: Record<string, { tasks: Task[]; total_minutes: number }>;
}

export interface Timeline {
  months: Record<string, Task[]>;
}

export interface CostSummary {
  year: number;
  total_cost: number;
  by_category: Record<string, number>;
  completions: TaskCompletion[];
}

export async function fetchDashboard(): Promise<Dashboard> {
  const res = await fetch(`${API_BASE}/tasks/dashboard`);
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export async function fetchTasks(params?: {
  category?: string;
  frequency?: string;
  priority?: string;
  overdue?: boolean;
}): Promise<Task[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.frequency) query.set("frequency", params.frequency);
  if (params?.priority) query.set("priority", params.priority);
  if (params?.overdue !== undefined) query.set("overdue", String(params.overdue));
  const res = await fetch(`${API_BASE}/tasks?${query}`);
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function fetchTask(id: number): Promise<TaskWithHistory> {
  const res = await fetch(`${API_BASE}/tasks/${id}`);
  if (!res.ok) throw new Error("Failed to fetch task");
  return res.json();
}

export async function completeTask(
  id: number,
  data: { notes?: string; cost?: number; photo_url?: string; duration_minutes?: number; contractor_id?: number }
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to complete task");
  return res.json();
}

export async function snoozeTask(id: number, days: number = 7): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/snooze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error("Failed to snooze task");
  return res.json();
}

export async function createTask(data: {
  name: string;
  description?: string;
  category: string;
  frequency: string;
  season?: string;
  priority?: string;
  estimated_minutes?: number;
  prefer_weekend?: boolean;
  next_due?: string;
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}

export async function updateTask(id: number, data: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete task");
}

export async function fetchWeekendPlan(): Promise<WeekendPlan> {
  const res = await fetch(`${API_BASE}/tasks/weekend-planner`);
  if (!res.ok) throw new Error("Failed to fetch weekend plan");
  return res.json();
}

export async function fetchTimeline(): Promise<Timeline> {
  const res = await fetch(`${API_BASE}/tasks/timeline`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function fetchCosts(year?: number): Promise<CostSummary> {
  const query = year ? `?year=${year}` : "";
  const res = await fetch(`${API_BASE}/tasks/costs${query}`);
  if (!res.ok) throw new Error("Failed to fetch costs");
  return res.json();
}

export async function fetchSupplies(params?: { task_id?: number; low_stock?: boolean }): Promise<Supply[]> {
  const query = new URLSearchParams();
  if (params?.task_id) query.set("task_id", String(params.task_id));
  if (params?.low_stock) query.set("low_stock", "true");
  const res = await fetch(`${API_BASE}/supplies?${query}`);
  if (!res.ok) throw new Error("Failed to fetch supplies");
  return res.json();
}

export async function createSupply(taskId: number, data: Partial<Supply>): Promise<Supply> {
  const res = await fetch(`${API_BASE}/supplies?task_id=${taskId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create supply");
  return res.json();
}

export async function updateSupply(id: number, data: Partial<Supply>): Promise<Supply> {
  const res = await fetch(`${API_BASE}/supplies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update supply");
  return res.json();
}

export async function deleteSupply(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/supplies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete supply");
}

export async function fetchAssets(params?: { category?: string }): Promise<Asset[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  const res = await fetch(`${API_BASE}/assets?${query}`);
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

export async function fetchAsset(id: number): Promise<AssetWithTasks> {
  const res = await fetch(`${API_BASE}/assets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch asset");
  return res.json();
}

export async function createAsset(data: {
  name: string;
  category: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  install_date?: string;
  warranty_expires?: string;
  expected_lifespan_years?: number;
  purchase_price?: number;
  manual_url?: string;
  notes?: string;
  location?: string;
}): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create asset");
  return res.json();
}

export async function updateAsset(id: number, data: Partial<Asset>): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update asset");
  return res.json();
}

export async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/assets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete asset");
}

export const CATEGORIES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "exterior", label: "Exterior" },
  { value: "outdoor", label: "Outdoor" },
  { value: "appliances", label: "Appliances" },
  { value: "safety", label: "Safety" },
  { value: "hot_tub", label: "Hot Tub" },
  { value: "garage", label: "Garage" },
  { value: "pest", label: "Pest Control" },
  { value: "other", label: "Other" },
] as const;

export const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "seasonal", label: "Seasonal" },
  { value: "annual", label: "Annual" },
  { value: "biannual", label: "Every 2 Years" },
  { value: "custom_days", label: "Custom" },
] as const;

export const PRIORITIES = [
  { value: "p1", label: "P1 Critical", color: "#ef4444" },
  { value: "p2", label: "P2 Important", color: "#f59e0b" },
  { value: "p3", label: "P3 Nice to Have", color: "#6b7280" },
] as const;

export const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
] as const;

export interface Asset {
  id: number;
  name: string;
  category: string;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expires: string | null;
  expected_lifespan_years: number | null;
  purchase_price: number | null;
  manual_url: string | null;
  notes: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  age_years: number | null;
  warranty_status: string;
  replacement_estimate: string | null;
}

export interface AssetWithTasks extends Asset {
  tasks: Task[];
}

export const LOCATIONS = [
  "Basement",
  "Kitchen",
  "Garage",
  "Attic",
  "Bathroom",
  "Living Room",
  "Laundry Room",
  "Utility Room",
  "Master Bedroom",
  "Exterior",
  "Backyard",
  "Roof",
  "Crawlspace",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  hvac: "#3b82f6",
  plumbing: "#06b6d4",
  electrical: "#f59e0b",
  exterior: "#84cc16",
  outdoor: "#22c55e",
  appliances: "#8b5cf6",
  safety: "#ef4444",
  hot_tub: "#ec4899",
  garage: "#6b7280",
  pest: "#f97316",
  other: "#a3a3a3",
};

export interface Contractor {
  id: number;
  name: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  total_spent: number;
  jobs_completed: number;
}

export interface CompletionHistoryItem {
  id: number;
  task_id: number;
  task_name: string;
  completed_at: string;
  cost: number | null;
  notes: string | null;
}

export interface ContractorWithHistory extends Contractor {
  recent_work: CompletionHistoryItem[];
}

export async function fetchContractors(params?: { specialty?: string }): Promise<Contractor[]> {
  const query = new URLSearchParams();
  if (params?.specialty) query.set("specialty", params.specialty);
  const res = await fetch(`${API_BASE}/contractors?${query}`);
  if (!res.ok) throw new Error("Failed to fetch contractors");
  return res.json();
}

export async function fetchContractor(id: number): Promise<ContractorWithHistory> {
  const res = await fetch(`${API_BASE}/contractors/${id}`);
  if (!res.ok) throw new Error("Failed to fetch contractor");
  return res.json();
}

export async function createContractor(data: {
  name: string;
  specialty: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
  rating?: number;
}): Promise<Contractor> {
  const res = await fetch(`${API_BASE}/contractors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create contractor");
  return res.json();
}

export async function updateContractor(id: number, data: Partial<Contractor>): Promise<Contractor> {
  const res = await fetch(`${API_BASE}/contractors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update contractor");
  return res.json();
}

export async function deleteContractor(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/contractors/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete contractor");
}

// === Notifications ===

export interface NotificationChannel {
  id: number;
  name: string;
  channel_type: "email" | "webhook" | "ntfy";
  enabled: boolean;
  config: Record<string, unknown>;
  notify_overdue: boolean;
  notify_due_today: boolean;
  notify_upcoming_days: number;
  created_at: string;
  updated_at: string;
}

export interface DigestTask {
  id: number;
  name: string;
  category: string;
  priority: string;
  next_due: string | null;
}

export interface DigestPreview {
  overdue: DigestTask[];
  due_today: DigestTask[];
  upcoming: DigestTask[];
  total_overdue: number;
  total_due_today: number;
  total_upcoming: number;
}

export async function fetchChannels(): Promise<NotificationChannel[]> {
  const res = await fetch(`${API_BASE}/notifications/channels`);
  if (!res.ok) throw new Error("Failed to fetch channels");
  return res.json();
}

export async function createChannel(data: Omit<NotificationChannel, "id" | "created_at" | "updated_at">): Promise<NotificationChannel> {
  const res = await fetch(`${API_BASE}/notifications/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create channel");
  return res.json();
}

export async function updateChannel(id: number, data: Partial<NotificationChannel>): Promise<NotificationChannel> {
  const res = await fetch(`${API_BASE}/notifications/channels/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update channel");
  return res.json();
}

export async function deleteChannel(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/channels/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete channel");
}

export async function testChannel(id: number): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/notifications/channels/${id}/test`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Test failed" }));
    throw new Error(err.detail || "Test failed");
  }
  return res.json();
}

export async function previewDigest(): Promise<DigestPreview> {
  const res = await fetch(`${API_BASE}/notifications/preview`);
  if (!res.ok) throw new Error("Failed to preview digest");
  return res.json();
}

export async function sendDigest(): Promise<{ status: string; results: { channel: string; status: string }[] }> {
  const res = await fetch(`${API_BASE}/notifications/send-digest`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to send digest");
  return res.json();
}

// === Documents ===

export interface Document {
  id: number;
  name: string;
  doc_type: string;
  url: string;
  asset_id: number | null;
  task_id: number | null;
  repair_id: number | null;
  notes: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
  expiry_status: string;
}

export const DOC_TYPES = [
  { value: "warranty", label: "Warranty" },
  { value: "manual", label: "Manual" },
  { value: "permit", label: "Permit" },
  { value: "inspection", label: "Inspection" },
  { value: "insurance", label: "Insurance" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
] as const;

export const DOC_TYPE_COLORS: Record<string, string> = {
  warranty: "#3b82f6",
  manual: "#8b5cf6",
  permit: "#f59e0b",
  inspection: "#22c55e",
  insurance: "#06b6d4",
  receipt: "#6b7280",
  other: "#a3a3a3",
};

export const EXPIRY_STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  expiring_soon: "#f59e0b",
  expired: "#ef4444",
  unknown: "#6b7280",
};

export async function fetchDocuments(params?: {
  doc_type?: string;
  asset_id?: number;
  task_id?: number;
  repair_id?: number;
}): Promise<Document[]> {
  const query = new URLSearchParams();
  if (params?.doc_type) query.set("doc_type", params.doc_type);
  if (params?.asset_id) query.set("asset_id", String(params.asset_id));
  if (params?.task_id) query.set("task_id", String(params.task_id));
  if (params?.repair_id) query.set("repair_id", String(params.repair_id));
  const res = await fetch(`${API_BASE}/documents?${query}`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function fetchDocument(id: number): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function createDocument(data: {
  name: string;
  doc_type: string;
  url: string;
  asset_id?: number;
  task_id?: number;
  repair_id?: number;
  notes?: string;
  expiry_date?: string;
}): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create document");
  return res.json();
}

export async function updateDocument(id: number, data: Partial<Document>): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update document");
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete document");
}

// === Export / Import ===

export interface ImportSummary {
  imported: Record<string, number>;
  skipped: Record<string, number>;
}

export async function exportJSON(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/json`);
  if (!res.ok) throw new Error("Failed to export JSON");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  a.download = match ? match[1] : "home-maintenance-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importJSON(data: unknown): Promise<ImportSummary> {
  const res = await fetch(`${API_BASE}/export/import-json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to import JSON");
  return res.json();
}

export async function exportCSV(type: "tasks" | "completions" | "assets" | "repairs"): Promise<void> {
  const res = await fetch(`${API_BASE}/export/csv/${type}`);
  if (!res.ok) throw new Error("Failed to export CSV");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  a.download = match ? match[1] : `${type}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPDFReport(): void {
  window.open(`${API_BASE}/export/pdf`, "_blank");
}

export const CHANNEL_TYPES = [
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook" },
  { value: "ntfy", label: "ntfy" },
] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  p1: "#ef4444",
  p2: "#f59e0b",
  p3: "#6b7280",
};

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
