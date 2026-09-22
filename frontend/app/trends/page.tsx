"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { HistoryPoint } from "@/lib/api";
import { getTelemetryRows } from "@/lib/telemetry-csv";
import NavSidebar from "@/components/ui/NavSidebar";
import MetricCard from "@/components/ui/MetricCard";
import ErrorState from "@/components/ui/ErrorState";
import { format, subDays, subMonths, subYears } from "date-fns";
import {
  Zap,
  Calendar as CalendarIcon,
  TrendingUp,
  Gauge,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ── Time-range presets ────────────────────────────────────────────────────── */
const TIME_RANGES = ["1D", "7D", "4W", "3M", "1Y", "Custom"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const TREND_CHART_STYLES: Record<string, { stroke: string; gradientId: string }> = {
  power: { stroke: "#f97316", gradientId: "trends-gradient-power" },
  voltage: { stroke: "#38bdf8", gradientId: "trends-gradient-voltage" },
  current: { stroke: "#60a5fa", gradientId: "trends-gradient-current" },
  lux: { stroke: "#facc15", gradientId: "trends-gradient-irradiance" },
};

function rangeToStart(range: TimeRange, now: Date): Date {
  switch (range) {
    case "1D":
      return subDays(now, 1);
    case "7D":
      return subDays(now, 7);
    case "4W":
      return subDays(now, 28);
    case "3M":
      return subMonths(now, 3);
    case "1Y":
      return subYears(now, 1);
    default:
      return subDays(now, 28);
  }
}

function rangeLabel(range: TimeRange, start: Date, end: Date): string {
  const fmt = (d: Date) => format(d, "MMM d, yyyy");
  switch (range) {
    case "1D":
      return `Last 24 hours`;
    case "7D":
      return `Last 7 days`;
    case "4W":
      return `${fmt(start)} - ${fmt(end)}  Last 4 weeks`;
    case "3M":
      return `Last 3 months`;
    case "1Y":
      return `Last 1 year`;
    default:
      return `${fmt(start)} - ${fmt(end)}`;
  }
}

export default function TrendsPage() {
  const { user } = useAuth();

  const [timeRange, setTimeRange] = useState<TimeRange>("4W");
  const [field, setField] = useState("power");
  const [dailyMode, setDailyMode] = useState("Daily");
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasetEnd, setDatasetEnd] = useState<Date | null>(null);

  const now = datasetEnd ?? new Date();
  const startDate = rangeToStart(timeRange, now);
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await getTelemetryRows();
      const latest = rows.reduce((max, row) => Math.max(max, Date.parse(row.timestamp)), 0);
      const end = new Date(latest);
      const start = rangeToStart(timeRange, end);
      setDatasetEnd(end);
      setData(rows
        .filter((row) => Date.parse(row.timestamp) >= start.getTime() && Date.parse(row.timestamp) <= end.getTime())
        .map((row) => ({ timestamp: row.timestamp, value: row[field as keyof typeof row] as number })));
      setError(null);
    } catch (e) {
      console.error(e);
      setData([]);
      setError("Failed to load trend data. Check the backend and selected date range.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, field, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Compute key statistics from data ─────────────────────────────────── */
  const stats = useMemo(() => {
    const pts = data;
    const vals = pts.map((p) => p.value);
    const total = vals.reduce((s, v) => s + v, 0);
    const avg = vals.length > 0 ? total / vals.length : 0;
    const peak = Math.max(...vals, 0);
    const peakIdx = vals.indexOf(peak);
    const min = vals.length > 0 ? Math.min(...vals) : 0;
    const minIdx = vals.indexOf(min);
    const days = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86400000));
    const avgDaily = total / days;

    return {
      totalGen: (total / 1000).toFixed(2),
      avgDaily: Math.round(avgDaily),
      avgPower: avg.toFixed(1),
      peakPower: peak.toFixed(1),
      bestDay: peakIdx >= 0 ? pts[peakIdx]?.timestamp : "—",
      bestDayVal: peakIdx >= 0 ? Math.round(vals[peakIdx]) : 0,
      lowestDay: minIdx >= 0 ? pts[minIdx]?.timestamp : "—",
      lowestDayVal: minIdx >= 0 ? Math.round(vals[minIdx]) : 0,
      totalActiveHours: "—",
      capacityFactor: "—",
      totalGenKwh: String(data.length),
      days: days,
    };
  }, [data, startDate, now]);

  const chartData = data.length > 0
    ? data.map((pt) => ({
        timestamp: pt.timestamp,
        date: (() => { try { return format(new Date(pt.timestamp), "MMM dd"); } catch { return pt.timestamp; } })(),
        value: pt.value,
      }))
    : [];
  const chartStyle = TREND_CHART_STYLES[field] ?? TREND_CHART_STYLES.power;

  const dailyData = data.map((point) => ({
    date: format(new Date(point.timestamp), "MMM d"),
    val: point.value,
  }));

  const exportCSV = () => {
    const header = "Date,Value\n";
    const rows = chartData.map((r) => `${r.date},${r.value}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "solar-trends.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-[#0b0f17]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Trends</h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1 font-medium">
              Historical power generation and performance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date range display */}
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-300 text-xs font-mono">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <span>{rangeLabel(timeRange, startDate, now)}</span>
            </div>

            {/* Time Range Pills */}
            <div className="flex items-center gap-1 bg-[#161c2b] p-1 rounded-xl border border-[#232d42]">
              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    timeRange === range
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121824] border border-[#1e293b] hover:border-slate-600 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </button>

          </div>
        </div>

        {error && !loading ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : (
          <div className="space-y-6">
            {/* ── 4 Top Metric Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                label="Power Samples"
                value={stats.totalGenKwh}
                unit="samples"
                icon={<Zap className="w-5 h-5" />}
                color="orange"
                trend="↑ 12%"
                subtext="vs previous 4 weeks"
              />
              <MetricCard
                label="Average Daily"
                value={String(stats.avgDaily)}
                unit="Wh/day"
                icon={<CalendarIcon className="w-5 h-5" />}
                color="amber"
                trend="↑ 8%"
                subtext="vs previous 4 weeks"
              />
              <MetricCard
                label="Peak Power"
                value={stats.peakPower}
                unit="W"
                icon={<TrendingUp className="w-5 h-5" />}
                color="purple"
                subtext={(() => { try { return format(new Date(stats.bestDay), "MMM d, yyyy"); } catch { return stats.bestDay; } })()}
              />
              <MetricCard
                label="Average Power"
                value={stats.avgPower}
                unit="W"
                icon={<Gauge className="w-5 h-5" />}
                color="blue"
                trend="↑ 6%"
                subtext="vs previous 4 weeks"
              />
            </div>

            {/* ── Power Generation Chart + Key Statistics ─────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Power Generation Area Chart */}
              <div className="xl:col-span-8 solar-card p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Power Generation</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Solar panel power output over time</p>
                  </div>
                  <select
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    className="bg-[#161c2b] border border-[#232d42] text-white text-xs font-semibold rounded-xl px-3.5 py-2 pr-8 focus:outline-none"
                  >
                    <option value="power">Power (W)</option>
                    <option value="voltage">Voltage (V)</option>
                    <option value="current">Current (A)</option>
                    <option value="lux">Irradiance (lux)</option>
                  </select>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-64 w-full" />
                  </div>
                ) : (
                  <div className="w-full pt-2">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={chartStyle.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartStyle.stroke} stopOpacity={0.5} />
                            <stop offset="95%" stopColor={chartStyle.stroke} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), timeRange === "1D" ? "HH:mm" : "MMM dd");
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          shared={timeRange !== "1D" ? false : undefined}
                          labelFormatter={(value) => {
                            try {
                              return format(new Date(value), "MMM d, yyyy HH:mm");
                            } catch {
                              return value;
                            }
                          }}
                          contentStyle={{ backgroundColor: "#141a27", borderColor: "#232f45", borderRadius: "12px", fontSize: "12px" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={chartStyle.stroke}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill={`url(#${chartStyle.gradientId})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Key Statistics Panel */}
              <div className="xl:col-span-4 solar-card p-6">
                <h3 className="text-base font-bold text-white mb-5">Key Statistics ({timeRange === "4W" ? "4 Weeks" : timeRange})</h3>
                <div className="space-y-3 text-xs">
                  {[
                    { label: "Power Samples", value: `${stats.totalGenKwh}` },
                    { label: "Average Daily Generation", value: `${stats.avgDaily} Wh` },
                    { label: "Average Power", value: `${stats.avgPower} W` },
                    { label: "Peak Power", value: `${stats.peakPower} W` },
                    { label: "Best Day", value: (() => { try { return `${format(new Date(stats.bestDay), "MMM d, yyyy")}\n${stats.bestDayVal} Wh`; } catch { return `${stats.bestDay}\n${stats.bestDayVal} Wh`; } })() },
                    { label: "Lowest Day", value: (() => { try { return `${format(new Date(stats.lowestDay), "MMM d, yyyy")}\n${stats.lowestDayVal} Wh`; } catch { return `${stats.lowestDay}\n${stats.lowestDayVal} Wh`; } })() },
                    //{ label: "Total Active Hours", value: `${stats.totalActiveHours} h` },
                    //{ label: "Capacity Factor", value: `${stats.capacityFactor} %` },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-slate-400 font-medium">{stat.label}</span>
                      <span className="text-white font-mono font-semibold text-right whitespace-pre-line">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Daily Energy Generation Bar Chart ───────────────────────── */}
            <div>
              {/* <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Power Samples</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Power readings returned for the selected range</p>
                </div>
                <select
                  value={dailyMode}
                  onChange={(e) => setDailyMode(e.target.value)}
                  className="bg-[#161c2b] border border-[#232d42] text-white text-xs font-semibold rounded-xl px-3.5 py-2 pr-8 focus:outline-none"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div> */}

              {/* <div className="w-full pt-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val) => [`${Number(val)} W`, "Power"]}
                      contentStyle={{ backgroundColor: "#141a27", borderColor: "#232f45", borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Bar dataKey="val" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div> */}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
