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
  dateTime: string;
  panel: string;
  severity: "Critical" | "Warning" | "Info" | "Resolved";
  alertName: string;
  details: string;
  status: "Open" | "Acknowledged" | "Resolved";
}

const DEFAULT_ALERTS: DisplayAlert[] = [
  {
    id: "a-1",
    dateTime: "Sep 4, 2026 14:23",
    panel: "P-05",
    severity: "Critical",
    alertName: "Low Power Output",
    details: "Power output 68% below expected. Possible fault or heavy shading.",
    status: "Open",
  },
  {
    id: "a-2",
    dateTime: "Sep 4, 2026 11:17",
    panel: "P-03",
    severity: "Warning",
    alertName: "Performance Drop",
    details: "Output 35% lower than expected for current irradiance.",
    status: "Open",
  },
  {
    id: "a-3",
    dateTime: "Sep 4, 2026 09:42",
    panel: "P-12",
    severity: "Warning",
    alertName: "High Temperature",
    details: "Panel temperature at 68°C (> 65°C threshold).",
    status: "Open",
  },
  {
    id: "a-4",
    dateTime: "Sep 3, 2026 16:05",
    panel: "P-08",
    severity: "Warning",
    alertName: "Abnormal Voltage",
    details: "Voltage 22% lower than normal range.",
    status: "Acknowledged",
  },
  {
    id: "a-5",
    dateTime: "Sep 3, 2026 13:21",
    panel: "P-01",
    severity: "Info",
    alertName: "Maintenance Due",
    details: "Scheduled maintenance in 7 days.",
    status: "Open",
  },
  {
    id: "a-6",
    dateTime: "Sep 2, 2026 10:14",
    panel: "P-15",
    severity: "Info",
    alertName: "Irradiance Low",
    details: "Low sunlight levels detected (120 lux).",
    status: "Resolved",
  },
  {
    id: "a-7",
    dateTime: "Sep 2, 2026 08:33",
    panel: "P-06",
    severity: "Resolved",
    alertName: "Communication Restored",
    details: "Panel back online after 5 minutes downtime.",
    status: "Resolved",
  },
  {
    id: "a-8",
    dateTime: "Sep 1, 2026 17:46",
    panel: "P-14",
    severity: "Info",
    alertName: "System Update",
    details: "Firmware updated successfully to v1.2.3.",
    status: "Resolved",
  },
];

export default function AlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setCriticalAlertCount } = useAppContext();

  const [alertsList, setAlertsList] = useState<DisplayAlert[]>(DEFAULT_ALERTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelFilter, setPanelFilter] = useState("All Panels");
  const [timeFilter, setTimeFilter] = useState("Last 7 days");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    const cancelled = false;

    const fetchApiAlerts = async () => {
      try {
        const d = await getAlerts();
        if (cancelled) return;
        if (d.alerts && d.alerts.length > 0) {
          const mapped: DisplayAlert[] = d.alerts.map((a: ApiAlert, idx: number) => ({
            id: a.id || `api-${idx}`,
            dateTime: new Date(a.timestamp).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            panel: `P-0${(idx % 5) + 1}`,
            severity: a.severity === "high" ? "Critical" : a.severity === "medium" ? "Warning" : "Info",
            alertName: a.type || "Sensor Alert",
            details: a.message,
            status: a.resolved ? "Resolved" : "Open",
          }));
          setAlertsList(mapped);
          const criticalCount = d.alerts.filter((a) => a.severity === "high" && !a.resolved).length;
          setCriticalAlertCount(criticalCount);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchApiAlerts();
  }, [user, setCriticalAlertCount]);

  const filtered = alertsList.filter((item) => {
    const matchesSearch =
      item.alertName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.panel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPanel = panelFilter === "All Panels" || item.panel === panelFilter;
    return matchesSearch && matchesPanel;
  });

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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121824] border border-[#1e293b] text-white text-xs pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-slate-500"
              />
            </div>

            {/* Panels Filter Dropdown */}
            <select
              value={panelFilter}
              onChange={(e) => setPanelFilter(e.target.value)}
              className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="All Panels">All Panels</option>
              <option value="P-01">Panel P-01</option>
              <option value="P-03">Panel P-03</option>
              <option value="P-05">Panel P-05</option>
              <option value="P-08">Panel P-08</option>
              <option value="P-12">Panel P-12</option>
            </select>

            {/* Time Filter Dropdown */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="Last 7 days">Last 7 days</option>
              <option value="Last 24 hours">Last 24 hours</option>
              <option value="Last 30 days">Last 30 days</option>
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
              <p className="text-3xl font-extrabold text-white mt-0.5">1</p>
              <p className="text-[11px] text-slate-400 mt-1">Requires immediate action</p>
            </div>
          </div>

          <div className="solar-card p-5 border-amber-500/20 bg-[#191817] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Warning</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">3</p>
              <p className="text-[11px] text-slate-400 mt-1">Needs attention</p>
            </div>
          </div>

          <div className="solar-card p-5 border-sky-500/20 bg-[#141822] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Info</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">4</p>
              <p className="text-[11px] text-slate-400 mt-1">For your information</p>
            </div>
          </div>

          <div className="solar-card p-5 border-emerald-500/20 bg-[#131a1e] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Resolved</p>
              <p className="text-3xl font-extrabold text-white mt-0.5">12</p>
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
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {filtered.map((item) => (
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
                    <td className="px-6 py-4 text-xs text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-colors">
                          View
                        </button>
                        <button className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-[#1e293b] bg-[#0f141f] gap-4">
            <span className="text-xs text-slate-400 font-medium">
              Showing 1–8 of 20 alerts
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                className="p-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[1, 2, 3].map((p) => (
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
                onClick={() => setPage(Math.min(3, page + 1))}
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
