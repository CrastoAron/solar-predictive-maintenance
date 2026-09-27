"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { getAlerts, Alert as ApiAlert } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  MoreHorizontal,
  ArrowUpDown,
} from "lucide-react";

interface DisplayAlert {
  id: string;
  timestamp: string;
  dateTime: string;
  panel: string;
  severity: "Critical" | "Warning" | "Info" | "Resolved";
  alertName: string;
  details: string;
  status: "Open" | "Acknowledged" | "Resolved";
}

export default function AlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setCriticalAlertCount } = useAppContext();

  const [alertsList, setAlertsList] = useState<DisplayAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelFilter, setPanelFilter] = useState("All Panels");
  const [timeFilter, setTimeFilter] = useState("All time");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchApiAlerts = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const d = await getAlerts();
        if (cancelled) return;
        const mapped: DisplayAlert[] = d.alerts.map((a: ApiAlert, idx: number) => ({
            id: a.id || `api-${idx}`,
            timestamp: a.timestamp,
            dateTime: new Date(a.timestamp).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            panel: a.panel_name || a.device_id || "Unassigned panel",
            severity: a.severity === "high" ? "Critical" : a.severity === "medium" ? "Warning" : "Info",
            alertName: a.type || "Sensor Alert",
            details: a.message,
            status: a.resolved ? "Resolved" : "Open",
          }));
        setAlertsList(mapped);
        const criticalCount = d.alerts.filter((a) => a.severity === "high" && !a.resolved).length;
        setCriticalAlertCount(criticalCount);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setAlertsList([]);
          setLoadError(true);
          setCriticalAlertCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchApiAlerts();
    return () => { cancelled = true; };
  }, [user, setCriticalAlertCount]);

  const filtered = alertsList.filter((item) => {
    const matchesSearch =
      item.alertName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.panel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPanel = panelFilter === "All Panels" || item.panel === panelFilter;
    const ageMs = Date.now() - new Date(item.timestamp).getTime();
    const rangeMs = timeFilter === "Last 24 hours" ? 24 * 60 * 60 * 1000 : timeFilter === "Last 30 days" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const matchesTime = timeFilter === "All time" || ageMs <= rangeMs;
    return matchesSearch && matchesPanel && matchesTime;
  });

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleAlerts = filtered.slice((page - 1) * pageSize, page * pageSize);
  const panelOptions = Array.from(new Set(alertsList.map((item) => item.panel)));

  const criticalCount = alertsList.filter((item) => item.severity === "Critical" && item.status !== "Resolved").length;
  const warningCount = alertsList.filter((item) => item.severity === "Warning" && item.status !== "Resolved").length;
  const infoCount = alertsList.filter((item) => item.severity === "Info" && item.status !== "Resolved").length;
  const resolvedCount = alertsList.filter((item) => item.status === "Resolved").length;

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "Critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Critical
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Warning
          </span>
        );
      case "Info":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Info
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Open
          </span>
        );
      case "Acknowledged":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Acknowledged
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b0f17]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Alerts</h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1 font-medium">
              Real-time alerts and system notifications
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full bg-[#121824] border border-[#1e293b] text-white text-xs pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-slate-500"
              />
            </div>

            {/* Panels Filter Dropdown */}
            

            {/* Time Filter Dropdown */}
            <select
              value={timeFilter}
              onChange={(e) => { setTimeFilter(e.target.value); setPage(1); }}
              className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="Last 7 days">Last 7 days</option>
              <option value="Last 24 hours">Last 24 hours</option>
              <option value="Last 30 days">Last 30 days</option>
              <option value="All time">All time</option>
            </select>
          </div>
        </div>

        {/* 4 Alert Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="solar-card p-5 border-red-500/20 bg-[#16141c] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Critical</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">{criticalCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Requires immediate action</p>
            </div>
          </div>

          <div className="solar-card p-5 border-amber-500/20 bg-[#191817] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Warning</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">{warningCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Needs attention</p>
            </div>
          </div>

          <div className="solar-card p-5 border-sky-500/20 bg-[#141822] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Info</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">{infoCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">For your information</p>
            </div>
          </div>

          <div className="solar-card p-5 border-emerald-500/20 bg-[#131a1e] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Resolved</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">{resolvedCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">In the last 7 days</p>
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="solar-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#0f141f]">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Date & Time <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Panel <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Severity <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Alert <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Status <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Loading alerts...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-red-400">Could not load alerts. Check your connection and try again.</td></tr>
                ) : visibleAlerts.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">No alerts match the current filters.</td></tr>
                ) : visibleAlerts.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-300 font-mono">
                      {item.dateTime}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-white font-mono">
                      {item.panel}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {getSeverityBadge(item.severity)}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-white">
                      {item.alertName}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 max-w-md truncate">
                      {item.details}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-[#1e293b] bg-[#0f141f] gap-4">
            <span className="text-xs text-slate-400 font-medium">
              Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} alerts
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    page === p
                      ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
                      : "bg-[#121824] border border-[#1e293b] text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
