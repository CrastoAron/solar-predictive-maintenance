"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NavSidebar from "@/components/ui/NavSidebar";
import Header from "@/components/ui/Header";
import {
  Plus,
  Zap,
  BarChart3,
  Trophy,
  MoreHorizontal,
  ArrowUpDown,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { getPanels, getServiceHistory, HistoryPoint, MaintenanceTask, PanelData } from "@/lib/api";
import { getTelemetryRows } from "@/lib/telemetry-csv";

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [scope, setScope] = useState("Entire Installation");
  const [timeRange, setTimeRange] = useState("Last 30 days");
  const [genRange, setGenRange] = useState("30 Days");
  const [energyData, setEnergyData] = useState<HistoryPoint[]>([]);
  const [serviceRecords, setServiceRecords] = useState<MaintenanceTask[]>([]);
  const [panels, setPanels] = useState<PanelData[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    const days = genRange === "7 Days" ? 7 : genRange === "3 Months" ? 90 : genRange === "1 Year" ? 365 : 30;
    getTelemetryRows()
      .then((rows) => {
        const end = new Date(Math.max(...rows.map((row) => Date.parse(row.timestamp))));
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        setEnergyData(rows
          .filter((row) => Date.parse(row.timestamp) >= start.getTime() && Date.parse(row.timestamp) <= end.getTime())
          .map((row) => ({ timestamp: row.timestamp, value: row.power })));
        setHistoryError(null);
      })
      .catch(() => {
        setEnergyData([]);
        setHistoryError("Energy history is unavailable.");
      });
  }, [user, genRange]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getPanels(), getServiceHistory()])
      .then(([panelRecords, tasks]) => {
        setPanels(panelRecords);
        setServiceRecords(tasks);
        setServiceError(null);
      })
      .catch(() => {
        setPanels([]);
        setServiceRecords([]);
        setServiceError("Service history is unavailable.");
      });
  }, [user]);

  const chartData = energyData.map((point) => ({
    timestamp: point.timestamp,
    date: new Date(point.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    val: point.value,
  }));
  const totalGeneration = energyData.reduce((total, point) => total + point.value, 0);
  const averageGeneration = energyData.length ? totalGeneration / energyData.length : 0;
  const bestPoint = energyData.reduce<HistoryPoint | null>((best, point) => !best || point.value > best.value ? point : best, null);

  const exportCSV = () => {
    const header = "Date,Service,Scope,PerformedBy,Status,Notes\n";
    const rows = serviceRecords.map(
      (record) => `${record.scheduled_date || ""},${record.task_name},${getPanelName(record.panel_id)},${record.assigned_to || "Unassigned"},${record.status},${record.description || ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "solar-service-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPanelName = (panelId: string | null) =>
    panels.find((panel) => panel.id === panelId)?.name || "Entire Installation";

  return (
    <div className="flex min-h-screen bg-[#0b0f17]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">History</h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1 font-medium">
              Energy generation and service records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Scope Filter */}
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none"
            >
              <option value="Entire Installation">Entire Installation</option>
              <option value="Array A">Array A</option>
              <option value="Array B">Array B</option>
            </select>

            {/* Time Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-[#121824] border border-[#1e293b] text-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none"
            >
              <option value="Last 30 days">Last 30 days</option>
              <option value="Last 90 days">Last 90 days</option>
              <option value="Last 1 year">Last 1 year</option>
            </select>

            <button
              onClick={exportCSV}
              className="p-2.5 rounded-xl bg-[#121824] border border-[#1e293b] hover:border-slate-600 text-slate-400 hover:text-white transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Upper Card: Energy Generation */}
          <div className="solar-card p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Power History</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Power readings returned by your solar installation
                </p>
              </div>

              {/* Time Range Pills */}
              <div className="flex items-center gap-1 bg-[#161c2b] p-1 rounded-xl border border-[#232d42]">
                {["7 Days", "30 Days", "3 Months", "1 Year"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setGenRange(range)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      genRange === range
                        ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid layout: Bar Chart (left) + Metrics Column (right) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-9 pt-2">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      shared={false}
                      labelFormatter={(_, payload) => {
                        const timestamp = payload?.[0]?.payload?.timestamp;
                        return timestamp ? new Date(timestamp).toLocaleString() : "Power reading";
                      }}
                      formatter={(val: any) => [`${val} W`, "Power"]}
                      contentStyle={{ backgroundColor: "#141a27", borderColor: "#232f45", borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Bar dataKey="val" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Right Side Metrics Column */}
              <div className="xl:col-span-3 space-y-3 flex flex-col justify-center">
                {/* Total Generation */}
                <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Samples</p>
                        <p className="text-xl font-black text-white mt-0.5">{energyData.length}</p>
                    </div>
                  </div>
                </div>

                {/* Average per Day */}
                <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average Power</p>
                      <p className="text-xl font-black text-white mt-0.5">{averageGeneration.toFixed(1)} W</p>
                    </div>
                  </div>
                </div>

                {/* Best Day */}
                <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Best Day</p>
                    <p className="text-xl font-black text-white mt-0.5">{bestPoint ? `${bestPoint.value.toFixed(1)} W` : "—"}</p>
                    <p className="text-[11px] text-slate-400">{bestPoint ? new Date(bestPoint.timestamp).toLocaleDateString() : "No history"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lower Card: Service History */}
          <div className="solar-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Service History</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record of maintenance and service activities
                </p>
              </div>

              {(historyError || serviceError) && <p className="text-xs text-amber-400">{serviceError || historyError}</p>}

              <button disabled className="px-4 py-2 rounded-xl bg-sky-600/40 text-white/50 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto cursor-not-allowed" title="Service records are not available from the backend">
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </div>

            {/* Service History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1e293b] bg-[#0f141f]">
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                        Date <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                        Service <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                        Panel / Scope <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                        Performed by <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1 cursor-pointer hover:text-white">
                        Status <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Notes
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60 text-xs">
                  {serviceRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                        {record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : "No date"}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        {record.task_name}
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono">
                        {getPanelName(record.panel_id)}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {record.assigned_to || "Unassigned"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {record.description || record.task_type}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 pt-4 text-xs text-slate-400 font-medium">
              Showing {serviceRecords.length === 0 ? 0 : 1}–{serviceRecords.length} of {serviceRecords.length} records.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
