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
  CheckCircle2,
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

const ENERGY_DATA = [
  { date: "Aug 6", val: 240 },
  { date: "Aug 8", val: 320 },
  { date: "Aug 10", val: 280 },
  { date: "Aug 12", val: 410 },
  { date: "Aug 14", val: 350 },
  { date: "Aug 16", val: 310 },
  { date: "Aug 18", val: 290 },
  { date: "Aug 20", val: 440 },
  { date: "Aug 21", val: 612 },
  { date: "Aug 23", val: 480 },
  { date: "Aug 25", val: 450 },
  { date: "Aug 27", val: 420 },
  { date: "Aug 29", val: 390 },
  { date: "Aug 31", val: 350 },
  { date: "Sep 3", val: 310 },
];

const SERVICE_RECORDS = [
  {
    id: "s-1",
    date: "Sep 2, 2026",
    service: "Panel cleaning",
    scope: "P-05",
    performedBy: "SolarTech",
    status: "Completed",
    notes: "Performance restored",
  },
  {
    id: "s-2",
    date: "Aug 14, 2026",
    service: "Wiring inspection",
    scope: "P-03",
    performedBy: "SolarTech",
    status: "Completed",
    notes: "No issues found",
  },
  {
    id: "s-3",
    date: "Jul 21, 2026",
    service: "Routine inspection",
    scope: "All Panels",
    performedBy: "In-house",
    status: "Completed",
    notes: "System healthy",
  },
  {
    id: "s-4",
    date: "Jun 8, 2026",
    service: "Panel cleaning",
    scope: "P-01",
    performedBy: "SolarTech",
    status: "Completed",
    notes: "Removed dust buildup",
  },
  {
    id: "s-5",
    date: "Apr 16, 2026",
    service: "Inverter check",
    scope: "All Panels",
    performedBy: "SolarTech",
    status: "Completed",
    notes: "Normal operation",
  },
];

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [scope, setScope] = useState("Entire Installation");
  const [timeRange, setTimeRange] = useState("30 Days");
  const [genRange, setGenRange] = useState("30 Days");

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const exportCSV = () => {
    const header = "Date,Service,Scope,PerformedBy,Status,Notes\n";
    const rows = SERVICE_RECORDS.map(
      (r) => `${r.date},${r.service},${r.scope},${r.performedBy},${r.status},${r.notes}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solar-service-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                <h2 className="text-base font-bold text-white tracking-tight">Energy Generation</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total energy produced by your solar installation
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
              <div className="xl:col-span-8 pt-2">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ENERGY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: any) => [`${val} Wh`, "Energy"]}
                      contentStyle={{ backgroundColor: "#141a27", borderColor: "#232f45", borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Bar dataKey="val" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Right Side Metrics Column */}
              <div className="xl:col-span-4 space-y-3 flex flex-col justify-center">
                {/* Total Generation */}
                <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Generation</p>
                      <p className="text-xl font-black text-white mt-0.5">12.84 kWh</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    ↑ 12%
                  </span>
                </div>

                {/* Average per Day */}
                <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average per Day</p>
                      <p className="text-xl font-black text-white mt-0.5">428 Wh</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    ↑ 8%
                  </span>
                </div>

                {/* Best Day */}
                <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Best Day</p>
                    <p className="text-xl font-black text-white mt-0.5">612 Wh</p>
                    <p className="text-[11px] text-slate-400">Aug 21, 2026</p>
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

              <button className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-sky-600/20 self-start sm:self-auto">
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
                  {SERVICE_RECORDS.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                        {rec.date}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        {rec.service}
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono">
                        {rec.scope}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {rec.performedBy}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {rec.notes}
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
              Showing 1–5 of 5 records
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
