"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/lib/toast-context";
import { DiagnosticResult, getDiagnostics, getExpectedPower, getHardwareStatus, getHistory, getLive, ExpectedPowerData, HardwareStatusData, LiveData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import MetricCard from "@/components/ui/MetricCard";
import StatusBadge from "@/components/ui/StatusBadge";
import LineChart from "@/components/ui/LineChart";
import ErrorState from "@/components/ui/ErrorState";
import { Zap, Activity, Gauge, TrendingUp, RefreshCw } from "lucide-react";

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
const DIAGNOSTICS_POLL_MS = 5_000;

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setConnectionStatus } = useAppContext();
  const { addToast } = useToast();

  const [live, setLive] = useState<LiveData | null>(null);
  const [expectedPower, setExpectedPower] = useState<ExpectedPowerData | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatusData | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [chartData, setChartData] = useState<{ timestamp: string; value: number }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const expectedPowerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardwareStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diagnosticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const fetchExpectedPower = useCallback(async () => {
    try {
      const data = await getExpectedPower();
      setExpectedPower(data);
    } catch (e) {
      console.error(e);
      setExpectedPower(null);
    }
  }, []);

  const fetchHardwareStatus = useCallback(async () => {
    try {
      const data = await getHardwareStatus();
      setHardwareStatus(data);
    } catch (e) {
      console.error(e);
      setHardwareStatus(null);
    }
  }, []);

  const fetchDiagnosticResult = useCallback(async () => {
    try {
      const data = await getDiagnostics();
      setDiagnosticResult(data);
    } catch (e) {
      console.error(e);
      setDiagnosticResult(null);
    }
  }, []);

  // Start / stop intervals
  const startPolling = useCallback(() => {
    if (!intervalRef.current)     intervalRef.current     = setInterval(fetchLive, LIVE_POLL_MS);
    if (!expectedPowerIntervalRef.current) expectedPowerIntervalRef.current = setInterval(fetchExpectedPower, DIAGNOSTICS_POLL_MS);
    if (!hardwareStatusIntervalRef.current) hardwareStatusIntervalRef.current = setInterval(fetchHardwareStatus, DIAGNOSTICS_POLL_MS);
    if (!diagnosticIntervalRef.current) diagnosticIntervalRef.current = setInterval(fetchDiagnosticResult, DIAGNOSTICS_POLL_MS);
  }, [fetchLive, fetchExpectedPower, fetchHardwareStatus, fetchDiagnosticResult]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (expectedPowerIntervalRef.current) { clearInterval(expectedPowerIntervalRef.current); expectedPowerIntervalRef.current = null; }
    if (hardwareStatusIntervalRef.current) { clearInterval(hardwareStatusIntervalRef.current); hardwareStatusIntervalRef.current = null; }
    if (diagnosticIntervalRef.current) { clearInterval(diagnosticIntervalRef.current); diagnosticIntervalRef.current = null; }
  }, []);

  // Initial data load + polling
  useEffect(() => {
    if (!user) return;

    setConnectionStatus("connecting");
    fetchLive();
    fetchExpectedPower();
    fetchHardwareStatus();
    fetchDiagnosticResult();

    // Seed chart with last hour of history
    const now   = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    getHistory(start, now.toISOString(), "power")
      .then((h) => setChartData(h.data))
      .catch((e) => { console.error(e); setChartData([]); });

    startPolling();
    return () => stopPolling();
  }, [user, fetchLive, fetchExpectedPower, fetchHardwareStatus, fetchDiagnosticResult, startPolling, stopPolling, setConnectionStatus]);

  // Pause polling when tab is hidden, resume when visible
  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        fetchLive();
        fetchExpectedPower();
        fetchHardwareStatus();
        fetchDiagnosticResult();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, fetchLive, fetchExpectedPower, fetchHardwareStatus, fetchDiagnosticResult, startPolling, stopPolling]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLive();
    await fetchExpectedPower();
    await fetchHardwareStatus();
    await fetchDiagnosticResult();
    setRefreshing(false);
    addToast("success", "Dashboard refreshed successfully.");
  };

  const status = expectedPower?.operational_status ?? "Not evaluated (low light)";

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
                label="Actual Power"
                value={live?.power ?? "—"}
                unit="W"
                icon={<Gauge className="w-4 h-4" />}
                color="purple"
              />
              <MetricCard
                label="Expected Power"
                value={expectedPower?.expected_power ?? "—"}
                unit="W"
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
                  <p className="text-sm text-slate-500 uppercase tracking-widest mb-4">Expected-Power Baseline</p>
                  <div className="space-y-3">
                    {[
                      { label: "Expected Power", value: expectedPower?.expected_power !== null && expectedPower?.expected_power !== undefined ? `${expectedPower.expected_power.toFixed(2)} W` : "—" },
                      { label: "Performance", value: expectedPower?.performance_ratio !== null && expectedPower?.performance_ratio !== undefined ? `${(expectedPower.performance_ratio * 100).toFixed(1)}%` : "—" },
                      { label: "Status", value: expectedPower?.operational_status ?? "—" },
                      { label: "Evaluated At", value: expectedPower ? new Date(expectedPower.timestamp).toLocaleTimeString() : "—" },
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
                      { label: "BME280", value: hardwareStatus?.bme280 },
                      { label: "INA219", value: hardwareStatus?.ina219 },
                      { label: "BH1750", value: hardwareStatus?.bh1750 },
                      { label: "DS3231", value: hardwareStatus?.ds3231 },
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
                      Updated {hardwareStatus ? new Date(hardwareStatus.timestamp).toLocaleTimeString() : "—"}
                    </div>
                  </div>
                </div>
                <div className="glass-card p-5">
                  <p className="text-sm text-slate-500 uppercase tracking-widest mb-4">Explainable Diagnostics</p>
                  {diagnosticResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-base">Assessment</span>
                        <StatusBadge status={diagnosticResult.health} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-base">Likely cause</span>
                        <span className="text-white text-right text-base font-semibold">{diagnosticResult.root_cause}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-base">Confidence</span>
                        <span className="text-white text-base font-semibold">{diagnosticResult.confidence}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-base">Severity</span>
                        <span className="text-white text-base font-semibold">{diagnosticResult.severity}</span>
                      </div>
                      {diagnosticResult.evidence.length > 0 && (
                        <ul className="space-y-1 pt-2 text-sm leading-6 text-slate-400">
                          {diagnosticResult.evidence.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      )}
                      <p className="pt-2 text-sm leading-6 text-slate-300">{diagnosticResult.recommendation}</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-400">Awaiting telemetry to produce an explainable diagnostic assessment.</p>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="xl:col-span-2 glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="section-title">Actual Power Output</p>
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
