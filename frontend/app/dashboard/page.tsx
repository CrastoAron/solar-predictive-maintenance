"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/lib/toast-context";
import { getLive, getPredictions, getHistory, getHardwareStatus, LiveData, PredictionData, HardwareStatusData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import MetricCard from "@/components/ui/MetricCard";
import StatusBadge from "@/components/ui/StatusBadge";
import LineChart from "@/components/ui/LineChart";
import ErrorState from "@/components/ui/ErrorState";
import { Zap, Activity, Gauge, TrendingUp, RefreshCw } from "lucide-react";

const FAULT_LABELS: Record<number, string> = { 0: "Normal", 1: "Degraded", 2: "Fault" };

const STATUS_LABELS: Record<number, string> = {
  0: "OK",
  1: "Initialization Failed",
  2: "Device Not Found",
  3: "Invalid Data",
  4: "Read Error",
  5: "Device Specific Error",
};

const STATUS_CLASSES: Record<number, string> = {
  0: "text-emerald-400",
  1: "text-red-400",
  2: "text-red-400",
  3: "text-amber-400",
  4: "text-amber-400",
  5: "text-amber-400",
};

// Polling intervals (ms)
const LIVE_POLL_MS  = 5_000;
const PRED_POLL_MS  = 10_000;
const DIAGNOSTICS_POLL_MS = 5_000;

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setConnectionStatus } = useAppContext();
  const { addToast } = useToast();

  const [live, setLive] = useState<LiveData | null>(null);
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [diagnostics, setDiagnostics] = useState<HardwareStatusData | null>(null);
  const [chartData, setChartData] = useState<{ timestamp: string; value: number }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const predIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diagIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if not authed
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchLive = useCallback(async () => {
    try {
      const data = await getLive();
      if (!data) {
        setLive(null);
        return;
      }
      setLive(data);
      setLastUpdated(new Date());
      setConnectionStatus("live");
      setError(null);
      setChartData((prev) => {
        const next = [...prev, { timestamp: data.timestamp, value: data.power }];
        return next.slice(-12);
      });
    } catch (e) {
      console.error(e);
      setConnectionStatus("offline");
      setError("Could not reach the backend. Check that the server is running.");
      addToast("error", "Live data fetch failed — backend may be offline.");
    }
  }, [setConnectionStatus, addToast]);

  const fetchPredictions = useCallback(async () => {
    try {
      const p = await getPredictions();
      setPredictions(p);
    } catch (e) {
      console.error(e);
      setPredictions(null);
    }
  }, []);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const data = await getHardwareStatus();
      setDiagnostics(data);
    } catch (e) {
      console.error(e);
      setDiagnostics(null);
    }
  }, []);

  // Start / stop intervals
  const startPolling = useCallback(() => {
    if (!intervalRef.current)     intervalRef.current     = setInterval(fetchLive, LIVE_POLL_MS);
    if (!predIntervalRef.current) predIntervalRef.current = setInterval(fetchPredictions, PRED_POLL_MS);
    if (!diagIntervalRef.current) diagIntervalRef.current = setInterval(fetchDiagnostics, DIAGNOSTICS_POLL_MS);
  }, [fetchLive, fetchPredictions, fetchDiagnostics]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (predIntervalRef.current) { clearInterval(predIntervalRef.current); predIntervalRef.current = null; }
    if (diagIntervalRef.current) { clearInterval(diagIntervalRef.current); diagIntervalRef.current = null; }
  }, []);

  // Initial data load + polling
  useEffect(() => {
    if (!user) return;

    setConnectionStatus("connecting");
    fetchLive();
    fetchPredictions();
    fetchDiagnostics();

    // Seed chart with last hour of history
    const now   = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    getHistory(start, now.toISOString(), "power")
      .then((h) => setChartData(h.data))
      .catch((e) => { console.error(e); setChartData([]); });

    startPolling();
    return () => stopPolling();
  }, [user, fetchLive, fetchPredictions, fetchDiagnostics, startPolling, stopPolling, setConnectionStatus]);

  // Pause polling when tab is hidden, resume when visible
  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        fetchLive();
        fetchPredictions();
        fetchDiagnostics();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, fetchLive, fetchPredictions, fetchDiagnostics, startPolling, stopPolling]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLive();
    await fetchPredictions();
    await fetchDiagnostics();
    setRefreshing(false);
    addToast("success", "Dashboard refreshed successfully.");
  };

  const status = predictions ? FAULT_LABELS[predictions.fault_class] ?? "Normal" : "Normal";

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 text-base mt-1">
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

        {/* Error state */}
        {error && !live ? (
          <ErrorState message={error} onRetry={handleRefresh} />
        ) : (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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
                  <p className="text-sm text-slate-500 uppercase tracking-widest mb-4">Environment</p>
                  <div className="space-y-3">
                    {[
                      { label: "Temperature", value: live?.temperature, unit: "°C" },
                      { label: "Humidity",    value: live?.humidity,    unit: "%" },
                      { label: "Irradiance",  value: live?.lux,         unit: "lux" },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-slate-400 text-base">{label}</span>
                        <span className="text-white text-base font-semibold">
                          {value !== undefined ? `${value} ${unit}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-5">
                  <p className="text-sm text-slate-500 uppercase tracking-widest mb-4">Prediction</p>
                  <div className="space-y-3">
                    {[
                      { label: "Fault Status",   value: predictions?.fault_label ?? "—" },
                      { label: "Maintenance In", value: predictions ? `${predictions.maintenance_days} days` : "—" },
                      { label: "Predicted At",   value: predictions ? new Date(predictions.predicted_at).toLocaleTimeString() : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-slate-400 text-base">{label}</span>
                        <span className="text-white text-base font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card p-5">
                  <p className="text-sm text-slate-500 uppercase tracking-widest mb-4">Hardware Diagnostics</p>
                  <div className="space-y-3">
                    {[
                      { label: "BME280", value: diagnostics?.bme280 },
                      { label: "INA219", value: diagnostics?.ina219 },
                      { label: "BH1750", value: diagnostics?.bh1750 },
                      { label: "DS3231", value: diagnostics?.ds3231 },
                    ].map(({ label, value }) => {
                      const statusLabel = value !== undefined && value !== null ? STATUS_LABELS[value] : "—";
                      const statusClass = value !== undefined && value !== null ? STATUS_CLASSES[value] : "text-slate-400";
                      return (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-slate-400 text-base">{label}</span>
                          <span className={`text-base font-semibold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                    <div className="pt-3 text-xs text-slate-500">
                      Updated {diagnostics ? new Date(diagnostics.timestamp).toLocaleTimeString() : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="xl:col-span-2 glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="section-title">Power Output</p>
                    <p className="text-xs text-slate-500 mt-0.5">Last 1 hour · polling every 5s</p>
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
          </>
        )}
      </main>
    </div>
  );
}
