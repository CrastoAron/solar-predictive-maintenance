"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getExpectedPower, getHistory, getLive, getPanels, PanelData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import {
  LayoutGrid,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
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
  const [page, setPage] = useState(1);
  const [panels, setPanels] = useState<PanelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadPanels = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const records: PanelData[] = await getPanels();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const now = new Date();
        const panelItems = await Promise.all(records.map(async (panel): Promise<PanelItem> => {
          const unavailable: PanelItem = {
            id: panel.id,
            name: panel.name,
            setup: panel.setup,
            status: "Unavailable",
            currentPower: null,
            todayGen: null,
            performance: null,
            lastUpdated: "No recent data",
          };
          if (!panel.esp32_id) return unavailable;

          const [liveResult, expectedResult, historyResult] = await Promise.allSettled([
            getLive(panel.esp32_id),
            getExpectedPower(panel.esp32_id),
            getHistory(startOfDay.toISOString(), now.toISOString(), "power", panel.esp32_id),
          ]);
          const live = liveResult.status === "fulfilled" ? liveResult.value : null;
          const expected = expectedResult.status === "fulfilled" ? expectedResult.value : null;
          const history = historyResult.status === "fulfilled" ? historyResult.value.data : [];
          const points = history
            .map((point) => ({ time: new Date(point.timestamp).getTime(), value: point.value }))
            .filter((point) => Number.isFinite(point.time))
            .sort((a, b) => a.time - b.time);
          let wattHours = 0;
          let intervals = 0;
          for (let index = 1; index < points.length; index += 1) {
            const hours = (points[index].time - points[index - 1].time) / 3_600_000;
            if (hours > 0 && hours <= 0.25) {
              wattHours += ((points[index - 1].value + points[index].value) / 2) * hours;
              intervals += 1;
            }
          }
          const operationalStatus = expected?.operational_status;
          const status = operationalStatus === "Normal"
            ? "Healthy"
            : operationalStatus === "Underperforming"
              ? "Warning"
              : operationalStatus === "Strong anomaly"
                ? "Critical"
                : "Unavailable";
          const timestamp = live?.timestamp || expected?.timestamp;

          return {
            ...unavailable,
            status,
            currentPower: live?.power ?? expected?.actual_power ?? null,
            todayGen: intervals > 0 ? Math.round(wattHours) : null,
            performance: expected?.performance_ratio == null
              ? null
              : Math.min(100, Math.max(0, Math.round(expected.performance_ratio * 100))),
            lastUpdated: timestamp ? new Date(timestamp).toLocaleString() : "No recent data",
          };
        }));
        if (!cancelled) setPanels(panelItems);
      } catch {
        if (!cancelled) {
          setPanels([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPanels();
    return () => { cancelled = true; };
  }, [user]);

  const filteredPanels = panels.filter((p) =>
    `${p.id} ${p.name} ${p.setup.name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredPanels.length / pageSize));
  const visiblePanels = filteredPanels.slice((page - 1) * pageSize, page * pageSize);

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
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search panels..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
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

        {loadError && (
          <p className="mb-4 text-sm text-red-400" role="alert">Could not load panels. Check your connection and try again.</p>
        )}

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
                      Today&apos;s Generation <ArrowUpDown className="w-3 h-3" />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Loading panel telemetry...</td></tr>
                ) : visiblePanels.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">{loadError ? "Panel data is unavailable." : "No panels match your search."}</td></tr>
                ) : visiblePanels.map((panel) => (
                  <tr key={panel.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-white flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      {panel.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <div className="font-medium text-white">{panel.setup.name}</div>
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
                          {panel.performance == null ? "—" : `${Math.min(100, panel.performance)}%`}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getProgressColor(panel.performance ?? 0)}`}
                            style={{ width: `${Math.min(100, Math.max(0, panel.performance ?? 0))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {panel.lastUpdated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-[#1e293b] bg-[#0f141f] gap-4">
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredPanels.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredPanels.length)} of {filteredPanels.length} panels
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
