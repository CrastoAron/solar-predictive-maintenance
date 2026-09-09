"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getHistory, HistoryData } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/lib/theme-context";
import { Download, Calendar, TrendingUp, BarChart2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";

const FIELD_CONFIG: Record<string, { label: string; unit: string; color: string }> = {
  power: { label: "Power Output", unit: "W", color: "#f97316" },
  voltage: { label: "Voltage", unit: "V", color: "#3b82f6" },
  current: { label: "Current", unit: "A", color: "#10b981" },
  irradiance: { label: "Solar Irradiance", unit: "W/m²", color: "#eab308" },
  temperature: { label: "Temperature", unit: "°C", color: "#ef4444" },
};

export default function TrendsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { addToast } = useToast();
  const isDark = resolvedTheme === "dark";

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(weekAgo.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [selectedField, setSelectedField] = useState("power");
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchTrends = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const data = await getHistory(
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString(),
        selectedField
      );
      setHistoryData(data);
    } catch (e) {
      console.error(e);
      addToast("error", "Failed to fetch trend history.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedField, addToast]);

  useEffect(() => {
    if (user) fetchTrends();
  }, [user, fetchTrends]);

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setEndDate(end.toISOString().split("T")[0]);
    setStartDate(start.toISOString().split("T")[0]);
  };

  const handleExportCSV = () => {
    if (!historyData || historyData.data.length === 0) {
      addToast("info", "No data available to export.");
      return;
    }
    const headers = "Timestamp,Value\n";
    const rows = historyData.data.map((d) => `${d.timestamp},${d.value}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solarshield_${selectedField}_${startDate}_to_${endDate}.csv`;
    a.click();
    addToast("success", "Exported CSV file successfully.");
  };

  const cfg = FIELD_CONFIG[selectedField] || FIELD_CONFIG.power;
  const data = historyData?.data || [];

  const values = data.map((d) => d.value);
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "0";
  const max = values.length ? Math.max(...values).toFixed(1) : "0";
  const min = values.length ? Math.min(...values).toFixed(1) : "0";

  const chartData = data.map((d) => {
    let label = d.timestamp;
    try {
      label = new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {}
    return { time: label, value: d.value };
  });

  return (
    <AppLayout
      title="Historical Trends"
      description="Telemetry analysis over custom date ranges"
      actions={
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:border-orange-500"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-primary)" }}
        >
          <Download className="w-4 h-4 text-orange-500" />
          <span>Export CSV</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Controls Card */}
        <div className="ss-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <Calendar className="w-4 h-4 text-orange-500" />
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ss-input py-1 px-3 text-xs"
              />
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="ss-input py-1 px-3 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <span>Metric:</span>
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="ss-input py-1 px-3 text-xs font-bold text-orange-500"
              >
                {Object.entries(FIELD_CONFIG).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Quick Range:</span>
            {[
              { label: "24h", days: 1 },
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => handleQuickRange(days)}
                className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all hover:border-orange-500"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--text-primary)" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Top 4 Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={`Average ${cfg.label}`} value={avg} unit={cfg.unit} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard label={`Peak ${cfg.label}`} value={max} unit={cfg.unit} icon={<BarChart2 className="w-5 h-5" />} />
          <StatCard label={`Minimum ${cfg.label}`} value={min} unit={cfg.unit} />
          <StatCard label="Total Telemetry Readings" value={data.length} unit="points" />
        </div>

        {/* Main Trend Chart */}
        <div className="ss-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {cfg.label} Trend Analysis
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Showing telemetry from {startDate} to {endDate}
              </p>
            </div>
            {loading && <span className="text-xs font-bold text-orange-500 animate-pulse">Loading telemetry...</span>}
          </div>

          <div style={{ width: "100%", height: 320 }}>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cfg.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={cfg.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit={` ${cfg.unit}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1a1a26" : "#ffffff",
                      borderColor: isDark ? "#2a2a3c" : "#e5e7eb",
                      borderRadius: "12px",
                      color: isDark ? "#ffffff" : "#111827",
                      fontSize: "12px",
                    }}
                    formatter={(val) => [`${Number(val ?? 0).toFixed(1)} ${cfg.unit}`, cfg.label]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={cfg.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#trendGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                No telemetry points recorded for this date range.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
