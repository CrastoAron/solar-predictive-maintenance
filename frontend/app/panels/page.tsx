"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getPanels, PanelData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import Header from "@/components/ui/Header";
import {
  LayoutGrid,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface PanelItem {
  id: string;
  name: string;
  setup: PanelData["setup"];
  status: "Healthy" | "Warning" | "Critical" | "Unavailable";
  currentPower: number | null;
  todayGen: number | null;
  performance: number | null;
  lastUpdated: string;
}

export default function PanelsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState("P-01 - P-05");
  const [page, setPage] = useState(1);
  const [panels, setPanels] = useState<PanelItem[]>([]);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    getPanels()
      .then((records: PanelData[]) => setPanels(records.map((panel) => ({
        id: panel.id,
        name: panel.name,
        setup: panel.setup,
        status: "Unavailable",
        currentPower: null,
        todayGen: null,
        performance: null,
        lastUpdated: "Unavailable",
      }))))
      .catch(() => setPanels([]));
  }, [user]);

  const filteredPanels = panels.filter((p) =>
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProgressColor = (perf: number) => {
    if (perf >= 80) return "bg-emerald-500";
    if (perf >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Healthy":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Healthy
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Warning
          </span>
        );
      case "Critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Critical
          </span>
        );
      case "Unavailable":
        return <span className="text-xs font-semibold text-slate-500">Unavailable</span>;
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Panels</h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1 font-medium">
              View and manage all connected solar panels
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Range Select Dropdown */}
            <select
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value)}
              className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="P-01 - P-05">P-01 – P-05</option>
              <option value="P-06 - P-10">P-06 – P-10</option>
              <option value="P-11 - P-15">P-11 – P-15</option>
              <option value="P-16 - P-20">P-16 – P-20</option>
            </select>

            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search panels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121824] border border-[#1e293b] text-white text-xs pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="solar-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Panels</p>
              <p className="text-3xl font-extrabold text-white mt-1">{panels.length}</p>
            </div>
          </div>

          <div className="solar-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Healthy</p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-1">{panels.filter((panel) => panel.status === "Healthy").length}</p>
            </div>
          </div>

          <div className="solar-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Warning</p>
              <p className="text-3xl font-extrabold text-amber-400 mt-1">{panels.filter((panel) => panel.status === "Warning").length}</p>
            </div>
          </div>

          <div className="solar-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical</p>
              <p className="text-3xl font-extrabold text-red-400 mt-1">{panels.filter((panel) => panel.status === "Critical").length}</p>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="solar-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#0f141f]">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      ID <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Setup
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Status <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Current Power <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Today's Generation <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Performance <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                      Last Updated <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {filteredPanels.slice(0, 5).map((panel) => (
                  <tr key={panel.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-white flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      {panel.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <div className="font-medium text-white">{panel.setup.name}</div>
                      <div className="text-xs text-slate-500">{panel.setup.rows} × {panel.setup.cols} array</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{getStatusBadge(panel.status)}</td>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-white">
                      {panel.currentPower == null ? "—" : `${panel.currentPower} W`}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-300">
                      {panel.todayGen == null ? "—" : `${panel.todayGen} Wh`}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-3 w-44">
                        <span className="font-mono text-xs font-bold text-white w-9">
                          {panel.performance == null ? "—" : `${panel.performance}%`}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getProgressColor(panel.performance ?? 0)}`}
                            style={{ width: `${panel.performance ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {panel.lastUpdated}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <button className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5">
                        View <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-[#1e293b] bg-[#0f141f] gap-4">
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredPanels.length === 0 ? 0 : (page - 1) * 5 + 1}–{Math.min(page * 5, filteredPanels.length)} of {filteredPanels.length} panels
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                className="p-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[1, 2, 3, 4].map((p) => (
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
                onClick={() => setPage(Math.min(4, page + 1))}
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
