"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Settings,
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle,
  ListChecks,
  Search,
  MoreHorizontal,
  ArrowUpDown,
  Calendar,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiHeaders } from "@/lib/api-config";

interface PanelConfig {
  id: string;
  name?: string;
  esp32_id: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  panels?: PanelConfig[];
}

interface MaintenanceTask {
  id: string;
  customer_id: string;
  panel_id: string | null;
  task_name: string;
  task_type: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  completed_date: string | null;
  assigned_to: string | null;
  description: string | null;
  estimated_duration_minutes: number | null;
  checklist: string[];
  created_at?: string;
}

const TASK_TYPES = ["Cleaning", "Inspection", "Replacement", "Software"];
const STATUSES = ["Scheduled", "Pending", "Overdue", "Completed"];
const PRIORITIES = ["Low", "Medium", "High"];

const TYPE_COLORS: Record<string, string> = {
  Cleaning: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  Inspection: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Replacement: "bg-red-500/15 text-red-400 border-red-500/25",
  Software: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  Pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  Overdue: "bg-red-500/15 text-red-400 border-red-500/25",
  Completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "text-slate-400",
  Medium: "text-amber-400",
  High: "text-red-400",
};

const PAGE_SIZE = 10;

export default function CustomerMaintenancePage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading, signOut } = useAuth();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [panels, setPanels] = useState<PanelConfig[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);

  // Filters
  const [filterPanel, setFilterPanel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Sort
  const [sortField, setSortField] = useState<string>("scheduled_date");
  const [sortAsc, setSortAsc] = useState(false);

  // Modal
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPanel, setFormPanel] = useState("");
  const [formType, setFormType] = useState("Inspection");
  const [formPriority, setFormPriority] = useState("Medium");
  const [formDate, setFormDate] = useState("");
  const [formDuration, setFormDuration] = useState<number | "">("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formChecklist, setFormChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // UI state
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!loading && role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, role, user, router]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    const token = localStorage.getItem("admin-token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setFetching(true);
    try {
      const [custRes, taskRes] = await Promise.all([
        fetch(`${API_BASE}/admin/customers/${params.customerId}`, {
          headers: apiHeaders(token),
        }),
        fetch(`${API_BASE}/admin/customers/${params.customerId}/maintenance`, {
          headers: apiHeaders(token),
        }),
      ]);
      if (custRes.status === 401 || custRes.status === 403) {
        router.replace("/login");
        return;
      }
      const custData = await custRes.json();
      if (custData) {
        setCustomer(custData);
        setPanels(custData.panels || []);
      }
      const taskData = await taskRes.json();
      if (taskData) {
        setTasks(taskData.tasks || []);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setFetching(false);
    }
  }, [params.customerId, router]);

  useEffect(() => {
    if (!loading && user && role === "admin" && params.customerId) {
      loadData();
    }
  }, [loading, role, user, params.customerId, loadData]);

  const getPanelName = (panelId: string | null) => {
    if (!panelId) return "\u2014";
    const panel = panels.find((p) => p.id === panelId);
    return panel?.name || panelId.slice(0, 8);
  };

  const filteredTasks = tasks
    .filter((t) => {
      if (filterPanel !== "all" && t.panel_id !== filterPanel) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterType !== "all" && t.task_type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.task_name.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.assigned_to || "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField] ?? "";
      const bVal = (b as unknown as Record<string, unknown>)[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const now = new Date();
  const totalTasks = tasks.length;
  const overdueTasks = tasks.filter((t) => t.status === "Overdue").length;
  const upcomingTasks = tasks.filter((t) => {
    if (t.status === "Completed" || t.status === "Overdue") return false;
    if (!t.scheduled_date) return false;
    const sched = new Date(t.scheduled_date);
    const diff = (sched.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;
  const completedTasks = tasks.filter((t) => {
    if (t.status !== "Completed") return false;
    if (!t.completed_date) return true;
    const comp = new Date(t.completed_date);
    const diff = (now.getTime() - comp.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30;
  }).length;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPanel("");
    setFormType("Inspection");
    setFormPriority("Medium");
    setFormDate("");
    setFormDuration("");
    setFormAssignee("");
    setFormChecklist([]);
    setNewChecklistItem("");
    setIsEditMode(false);
    setEditingTask(null);
  };

  const openNewTaskModal = () => {
    resetForm();
    setFormDate(new Date().toISOString().split("T")[0]);
    setIsNewTaskModalOpen(true);
  };

  const openEditModal = (task: MaintenanceTask) => {
    setIsEditMode(true);
    setEditingTask(task);
    setFormName(task.task_name);
    setFormDescription(task.description || "");
    setFormPanel(task.panel_id || "");
    setFormType(task.task_type);
    setFormPriority(task.priority);
    setFormDate(task.scheduled_date || "");
    setFormDuration(task.estimated_duration_minutes || "");
    setFormAssignee(task.assigned_to || "");
    setFormChecklist(task.checklist || []);
    setIsNewTaskModalOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin-token");
    if (!token) return;

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      task_name: formName.trim(),
      task_type: formType,
      priority: formPriority,
      scheduled_date: formDate || null,
      panel_id: formPanel || null,
      assigned_to: formAssignee.trim() || null,
      description: formDescription.trim() || null,
      estimated_duration_minutes: formDuration || null,
      checklist: formChecklist,
    };

    try {
      if (isEditMode && editingTask) {
        const res = await fetch(
          `${API_BASE}/admin/maintenance/${editingTask.id}?customer_id=${encodeURIComponent(params.customerId)}`,
          {
            method: "PUT",
            headers: apiHeaders(token, true),
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          const data = await res.json();
          setTasks((prev) =>
            prev.map((t) => (t.id === editingTask.id ? data.task : t))
          );
          if (selectedTask?.id === editingTask.id) {
            setSelectedTask(data.task);
          }
          showToast(`Task "${data.task.task_name}" updated!`);
        }
      } else {
        const res = await fetch(
          `${API_BASE}/admin/customers/${params.customerId}/maintenance`,
          {
            method: "POST",
            headers: apiHeaders(token, true),
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          const data = await res.json();
          setTasks((prev) => [data.task, ...prev]);
          showToast(`Task "${data.task.task_name}" created!`);
        }
      }
      setIsNewTaskModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to save task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (task: MaintenanceTask) => {
    const token = localStorage.getItem("admin-token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/maintenance/${task.id}?customer_id=${encodeURIComponent(params.customerId)}`, {
        method: "PUT",
        headers: apiHeaders(token, true),
        body: JSON.stringify({
          status: "Completed",
          completed_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
        if (selectedTask?.id === task.id) setSelectedTask(data.task);
        showToast(`"${task.task_name}" marked as complete!`);
      }
    } catch (err) {
      console.error("Failed to mark complete:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const token = localStorage.getItem("admin-token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/maintenance/${taskId}?customer_id=${encodeURIComponent(params.customerId)}`, {
        method: "DELETE",
        headers: apiHeaders(token),
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (selectedTask?.id === taskId) setSelectedTask(null);
        showToast("Task deleted.");
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setFormChecklist((prev) => [...prev, newChecklistItem.trim()]);
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (idx: number) => {
    setFormChecklist((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatDate = (d: string | null) => {
    if (!d) return "\u2014";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue = (task: MaintenanceTask) => {
    if (task.status === "Completed") return false;
    if (!task.scheduled_date) return false;
    return new Date(task.scheduled_date) < now;
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-slate-400">Loading Maintenance Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white selection:bg-orange-500 selection:text-white pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0f1117]/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/customers"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Customer Installation</p>
              <h1 className="text-xl font-bold tracking-tight text-white">{customer?.name || "Solar Customer"}</h1>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <Link
              href={`/admin/customers/${params.customerId}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                !pathname.includes("/maintenance")
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Setup
            </Link>
            <Link
              href={`/admin/customers/${params.customerId}/maintenance`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                pathname.includes("/maintenance")
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              Maintenance
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={openNewTaskModal}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
            <button
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {toastMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 text-sm animate-fade-in">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400 border border-blue-500/20">
              <ListChecks className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Tasks</p>
              <p className="text-2xl font-extrabold text-white">{totalTasks}</p>
              <p className="text-[11px] text-slate-500">Across all panels</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-red-500/10 p-3 text-red-400 border border-red-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Overdue</p>
              <p className="text-2xl font-extrabold text-white">{overdueTasks}</p>
              <p className="text-[11px] text-slate-500">Require attention</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400 border border-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Upcoming</p>
              <p className="text-2xl font-extrabold text-white">{upcomingTasks}</p>
              <p className="text-[11px] text-slate-500">Next 7 days</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Completed</p>
              <p className="text-2xl font-extrabold text-white">{completedTasks}</p>
              <p className="text-[11px] text-slate-500">In last 30 days</p>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterPanel}
            onChange={(e) => { setFilterPanel(e.target.value); setCurrentPage(1); }}
            className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-orange-500/50"
          >
            <option value="all">All Panels</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.esp32_id}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-orange-500/50"
          >
            <option value="all">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
            className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-orange-500/50"
          >
            <option value="all">All Task Types</option>
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex-1" />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search maintenance tasks..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-64 rounded-xl border border-[#1e293b] bg-[#121824] py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Main Content: Table + Detail Sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Task Table */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th
                      className="px-5 py-3.5 cursor-pointer hover:text-white transition"
                      onClick={() => handleSort("task_name")}
                    >
                      <span className="flex items-center gap-1">
                        Task <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="px-5 py-3.5">Panel</th>
                    <th
                      className="px-5 py-3.5 cursor-pointer hover:text-white transition"
                      onClick={() => handleSort("task_type")}
                    >
                      <span className="flex items-center gap-1">
                        Type <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="px-5 py-3.5 cursor-pointer hover:text-white transition"
                      onClick={() => handleSort("scheduled_date")}
                    >
                      <span className="flex items-center gap-1">
                        Scheduled Date <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="px-5 py-3.5 cursor-pointer hover:text-white transition"
                      onClick={() => handleSort("status")}
                    >
                      <span className="flex items-center gap-1">
                        Status <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-medium">
                  {paginatedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        {tasks.length === 0
                          ? "No maintenance tasks yet. Click \"+ New Task\" to create one."
                          : "No tasks match the current filters."}
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((task) => {
                      const selected = selectedTask?.id === task.id;
                      return (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`cursor-pointer transition ${
                            selected
                              ? "bg-orange-500/5 border-l-2 border-l-orange-500"
                              : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="px-5 py-3.5 font-semibold text-white max-w-[200px] truncate">
                            {task.task_name}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-slate-300">
                            {getPanelName(task.panel_id)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                TYPE_COLORS[task.task_type] || "bg-slate-500/15 text-slate-400 border-slate-500/25"
                              }`}
                            >
                              {task.task_type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-300">
                            <div>
                              {formatDate(task.scheduled_date)}
                              {isOverdue(task) && (
                                <p className="text-[10px] text-red-400 font-semibold">Overdue</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                STATUS_COLORS[task.status] || "bg-slate-500/15 text-slate-400 border-slate-500/25"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  task.status === "Completed"
                                    ? "bg-emerald-400"
                                    : task.status === "Overdue"
                                    ? "bg-red-400"
                                    : task.status === "Pending"
                                    ? "bg-amber-400"
                                    : "bg-sky-400"
                                }`}
                              />
                              {task.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredTasks.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
                <p className="text-xs text-slate-400">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, filteredTasks.length)} of{" "}
                  {filteredTasks.length} tasks
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    &lsaquo;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                        currentPage === p
                          ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    &rsaquo;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Task Detail Sidebar */}
          <div className="space-y-4">
            {selectedTask ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Task Details</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(selectedTask.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                    title="Delete Task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{selectedTask.task_name}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedTask.description || "No description provided."}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    STATUS_COLORS[selectedTask.status] || ""
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedTask.status === "Completed"
                        ? "bg-emerald-400"
                        : selectedTask.status === "Overdue"
                        ? "bg-red-400"
                        : selectedTask.status === "Pending"
                        ? "bg-amber-400"
                        : "bg-sky-400"
                    }`}
                  />
                  {selectedTask.status}
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Panel</p>
                    <p className="font-semibold text-white">{getPanelName(selectedTask.panel_id)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Task Type</p>
                    <p className="font-semibold text-white">{selectedTask.task_type}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">
                      <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
                      Scheduled Date
                    </p>
                    <p className={`font-semibold ${isOverdue(selectedTask) ? "text-red-400" : "text-white"}`}>
                      {formatDate(selectedTask.scheduled_date)}
                      {isOverdue(selectedTask) && " (Overdue)"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Assigned To</p>
                    <p className="font-semibold text-white">{selectedTask.assigned_to || "Unassigned"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Est. Duration</p>
                    <p className="font-semibold text-white">
                      {selectedTask.estimated_duration_minutes
                        ? `${selectedTask.estimated_duration_minutes} minutes`
                        : "\u2014"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Priority</p>
                    <p className={`font-bold ${PRIORITY_COLORS[selectedTask.priority] || "text-white"}`}>
                      {selectedTask.priority}
                    </p>
                  </div>
                </div>

                {selectedTask.description && (
                  <div>
                    <p className="text-xs font-bold text-white mb-1.5">Description</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedTask.description}</p>
                  </div>
                )}

                {selectedTask.checklist && selectedTask.checklist.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-white mb-2">Checklist</p>
                    <div className="space-y-1.5">
                      {selectedTask.checklist.map((item, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer hover:text-white transition"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500/30"
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                  {selectedTask.status !== "Completed" && (
                    <button
                      onClick={() => handleMarkComplete(selectedTask)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark Complete
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(selectedTask)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Task
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl text-center space-y-3">
                <Wrench className="mx-auto h-8 w-8 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">Select a task to view details.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New / Edit Task Modal */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-[#13151f] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
                  {isEditMode ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {isEditMode ? "Edit Task" : "New Maintenance Task"}
                </h3>
              </div>
              <button
                onClick={() => { setIsNewTaskModalOpen(false); resetForm(); }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Task Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean panel surface"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the maintenance task..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Panel</label>
                  <select
                    value={formPanel}
                    onChange={(e) => setFormPanel(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">No specific panel</option>
                    {panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.esp32_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Task Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 30"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Assigned To</label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Checklist Builder */}
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Checklist Items</label>
                {formChecklist.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {formChecklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 rounded-lg px-3 py-1.5 border border-slate-800">
                        <span className="flex-1">{item}</span>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(i)}
                          className="text-slate-500 hover:text-red-400 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add checklist item..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addChecklistItem}
                    className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsNewTaskModalOpen(false); resetForm(); }}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : isEditMode
                    ? "Save Changes"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
