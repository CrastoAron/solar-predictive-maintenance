"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getLive, getPredictions, getHistory, LiveData, PredictionData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import MetricCard from "@/components/ui/MetricCard";
import StatusBadge from "@/components/ui/StatusBadge";
import LineChart from "@/components/ui/LineChart";
import { Zap, Activity, Gauge, TrendingUp, RefreshCw } from "lucide-react";

const FAULT_LABELS: Record<number, string> = { 0: "Normal", 1: "Degraded", 2: "Fault" };

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [live, setLive] = useState<LiveData | null>(null);
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [chartData, setChartData] = useState<{ timestamp: string; value: number }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if not authed
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchLive = useCallback(async () => {
    try {
      const data = await getLive();
      // Backend can legitimately return `null` when no sensor data exists yet.
      if (!data) {
        setLive(null);
        return;
      }

      setLive(data);
      setLastUpdated(new Date());
      setChartData((prev) => {
        const next = [...prev, { timestamp: data.timestamp, value: data.power }];
        return next.slice(-12); // keep last 12 points (~1 hour at 5-min intervals)
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchLive();
    getPredictions().then(setPredictions);
    // Also seed chart with history
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    getHistory(start, now.toISOString(), "power").then((h) => {
      setChartData(h.data);
    });

    intervalRef.current = setInterval(fetchLive, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchLive]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLive();
    const p = await getPredictions();
    setPredictions(p);
    setRefreshing(false);
  };

  const status = predictions ? FAULT_LABELS[predictions.fault_class] ?? "Normal" : "Normal";

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">
              {lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : "Loading live data…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} large />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Voltage"
            value={live?.voltage ?? "—"}
            unit="V"
            icon={<Zap className="w-4 h-4" />}
            color="orange"
          />
          <MetricCard
            label="Current"
            value={live?.current ?? "—"}
            unit="A"
            icon={<Activity className="w-4 h-4" />}
            color="blue"
          />
          <MetricCard
            label="Power"
            value={live?.power ?? "—"}
            unit="W"
            icon={<Gauge className="w-4 h-4" />}
            color="purple"
          />
          <MetricCard
            label="Efficiency"
            value={predictions ? `${predictions.efficiency_score.toFixed(1)}` : "—"}
            unit="%"
            icon={<TrendingUp className="w-4 h-4" />}
            color="green"
          />
        </div>

        {/* Secondary metrics + Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Secondary stats */}
          <div className="xl:col-span-1 space-y-4">
            <div className="glass-card p-5">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Environment</p>
              <div className="space-y-3">
                {[
                  { label: "Temperature", value: live?.temperature, unit: "°C" },
                  { label: "Humidity", value: live?.humidity, unit: "%" },
                  { label: "Irradiance", value: live?.lux, unit: "lux" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">{label}</span>
                    <span className="text-white text-sm font-semibold">
                      {value !== undefined ? `${value} ${unit}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Prediction</p>
              <div className="space-y-3">
                {[
                  {
                    label: "Fault Status",
                    value: predictions?.fault_label ?? "—",
                  },
                  {
                    label: "Maintenance In",
                    value: predictions ? `${predictions.maintenance_days} days` : "—",
                  },
                  {
                    label: "Predicted At",
                    value: predictions
                      ? new Date(predictions.predicted_at).toLocaleTimeString()
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">{label}</span>
                    <span className="text-white text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="xl:col-span-2 glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-title">Power Output</p>
                <p className="text-xs text-slate-500 mt-0.5">Last 1 hour · polling every 30s</p>
              </div>
              <span className="text-xs text-orange-400 font-medium bg-orange-500/10 px-2 py-1 rounded-lg">
                Live
              </span>
            </div>
            {chartData.length > 0 ? (
              <LineChart data={chartData} height={220} />
            ) : (
              <div className="skeleton h-52 w-full" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
