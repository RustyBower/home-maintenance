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
  data: { notes?: string; cost?: number; photo_url?: string; duration_minutes?: number }
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
