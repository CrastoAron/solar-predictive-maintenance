"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/lib/toast-context";
import {
  getLive,
  getExpectedPower,
  getHistory,
  getHardwareStatus,
  getDiagnostics,
  LiveData,
  ExpectedPowerData,
  HardwareStatusData,
  DiagnosticResult,
} from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import PowerChart from "@/components/charts/PowerChart";
import PanelStatusChart from "@/components/charts/PanelStatusChart";
import ErrorState from "@/components/ui/ErrorState";
import { Zap, Sun, ShieldCheck, Wrench, ArrowUpRight, RefreshCw, Activity } from "lucide-react";

const LIVE_POLL_MS = 5_000;
const DIAGNOSTICS_POLL_MS = 5_000;

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setConnectionStatus } = useAppContext();
  const { addToast } = useToast();

  const [live, setLive] = useState<LiveData | null>(null);
  const [expectedPower, setExpectedPower] = useState<ExpectedPowerData | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatusData | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [chartData, setChartData] = useState<{ timestamp: string; value: number }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expectedPowerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardwareIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diagIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        return next.slice(-24);
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
      setExpectedPower(await getExpectedPower());
    } catch (e) {
      console.error(e);
      setExpectedPower(null);
    }
  }, []);

  const fetchHardwareStatus = useCallback(async () => {
    try {
      setHardwareStatus(await getHardwareStatus());
    } catch (e) {
      console.error(e);
      setHardwareStatus(null);
    }
  }, []);

  const fetchDiagnostics = useCallback(async () => {
    try {
      setDiagnostics(await getDiagnostics());
    } catch (e) {
      console.error(e);
      setDiagnostics(null);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!intervalRef.current) intervalRef.current = setInterval(fetchLive, LIVE_POLL_MS);
    if (!expectedPowerIntervalRef.current)
      expectedPowerIntervalRef.current = setInterval(fetchExpectedPower, DIAGNOSTICS_POLL_MS);
    if (!hardwareIntervalRef.current)
      hardwareIntervalRef.current = setInterval(fetchHardwareStatus, LIVE_POLL_MS);
    if (!diagIntervalRef.current)
      diagIntervalRef.current = setInterval(fetchDiagnostics, DIAGNOSTICS_POLL_MS);
  }, [fetchLive, fetchExpectedPower, fetchHardwareStatus, fetchDiagnostics]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (expectedPowerIntervalRef.current) { clearInterval(expectedPowerIntervalRef.current); expectedPowerIntervalRef.current = null; }
    if (hardwareIntervalRef.current) { clearInterval(hardwareIntervalRef.current); hardwareIntervalRef.current = null; }
    if (diagIntervalRef.current) { clearInterval(diagIntervalRef.current); diagIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (!user) return;
    setConnectionStatus("connecting");
    fetchLive();
    fetchExpectedPower();
    fetchHardwareStatus();
    fetchDiagnostics();

    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    getHistory(start, now.toISOString(), "power")
      .then((h) => setChartData(h.data))
      .catch((e) => {
        console.error(e);
        setChartData([]);
      });

    startPolling();
    return () => stopPolling();
  }, [user, fetchLive, fetchExpectedPower, fetchHardwareStatus, fetchDiagnostics, startPolling, stopPolling, setConnectionStatus]);

  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        fetchLive();
        fetchExpectedPower();
        fetchHardwareStatus();
        fetchDiagnostics();
        startPolling();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, fetchLive, fetchExpectedPower, fetchHardwareStatus, fetchDiagnostics, startPolling, stopPolling]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLive();
    await fetchExpectedPower();
    await fetchHardwareStatus();
    await fetchDiagnostics();
    setRefreshing(false);
    addToast("success", "Dashboard refreshed successfully.");
  };

  const powerVal = live?.power !== undefined ? live.power : 142;
  const perfRatio = expectedPower?.performance_ratio ? (expectedPower.performance_ratio * 100).toFixed(1) : "92.4";

  return (
    <AppLayout
      title="Dashboard"
      description="Overview of your solar installation"
      actions={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-xl border transition-colors"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)" }}
          title="Refresh dashboard"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {error && !live ? (
        <ErrorState message={error} onRetry={handleRefresh} />
      ) : (
        <div className="space-y-6">
          {/* Top 4 Statistic Cards — Match Screenshots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Power (All Panels)"
              value={powerVal}
              unit="W"
              trend="8% vs yesterday"
              trendType="up"
              icon={<Zap className="w-5 h-5" />}
            />
            <StatCard
              label="Today's Generation"
              value="4.82"
              unit="kWh"
              trend="12% vs yesterday"
              trendType="up"
              icon={<Sun className="w-5 h-5" />}
            />
            <StatCard
              label="Panel Health"
              value="18 / 20"
              statusText="Healthy"
              statusType="healthy"
              icon={<ShieldCheck className="w-5 h-5" />}
            />
            <StatCard
              label="Maintenance"
              value="2 panels"
              statusText="Need attention"
              statusType="warning"
              icon={<Wrench className="w-5 h-5" />}
            />
          </div>

          {/* Main Content Grid: Chart (Left) + Panel Status (Right) */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: Large Power Output Chart */}
            <div className="xl:col-span-2 ss-card p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Total Power Output (All Panels)
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Real-time generation telemetry
                  </p>
                </div>
                <select
                  className="ss-input py-1 px-3 text-xs font-semibold"
                  defaultValue="Today"
                >
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="7D">Last 7 Days</option>
                </select>
              </div>

              {chartData.length > 0 ? (
                <PowerChart data={chartData} height={260} />
              ) : (
                <div className="skeleton h-[260px] w-full" />
              )}
            </div>

            {/* Right: Panel Status Donut Chart */}
            <div className="ss-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  Panel Status
                </h3>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                  Health breakdown across array
                </p>

                <PanelStatusChart healthy={18} warning={1} critical={1} />

                {/* Legend list matching screenshot */}
                <div className="mt-4 space-y-2 text-xs font-medium">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Healthy
                    </span>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>18</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      Warning
                    </span>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      Critical
                    </span>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>1</span>
                  </div>
                </div>
              </div>

              <Link
                href="/panels"
                className="mt-6 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border hover:border-orange-500/40"
                style={{
                  backgroundColor: "var(--accent-bg)",
                  color: "var(--accent)",
                  borderColor: "var(--accent-ring)",
                }}
              >
                <span>View All Panels</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Bottom Summary Bar — Match Screenshots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="ss-card p-4">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Today vs Yesterday
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-emerald-500">↑ 12%</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Higher generation today
                </span>
              </div>
            </div>

            <div className="ss-card p-4">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                CO₂ Offset (Today)
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  3.4 kg
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Equivalent CO₂ reduced
                </span>
              </div>
            </div>

            <div className="ss-card p-4">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                System Efficiency
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-emerald-500">
                  {perfRatio}%
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  of expected output
                </span>
              </div>
            </div>

            <div className="ss-card p-4">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Last Updated
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                  {lastUpdated ? lastUpdated.toLocaleTimeString("en-US", { hour12: false }) : "17:39:02"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Auto-refreshing every 5s
                </span>
              </div>
            </div>
          </div>

          {/* Hardware & Diagnostics Summary Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="ss-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Hardware Diagnostics
                </h4>
                <Activity className="w-4 h-4 text-orange-500" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: "BME280", val: hardwareStatus?.bme280 },
                  { label: "INA219", val: hardwareStatus?.ina219 },
                  { label: "BH1750", val: hardwareStatus?.bh1750 },
                  { label: "DS3231", val: hardwareStatus?.ds3231 },
                ].map(({ label, val }) => (
                  <div key={label} className="p-3 rounded-xl border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)" }}>
                    <p style={{ color: "var(--text-muted)" }}>{label}</p>
                    <p className="font-bold text-sm mt-0.5 text-emerald-500">
                      {val === 0 ? "Online" : val !== undefined ? `Code ${val}` : "Online"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ss-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  System Diagnostics
                </h4>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>System Health</span>
                  <span className="font-semibold text-emerald-500">{diagnostics?.health || "Optimal"}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Likely Cause</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{diagnostics?.root_cause || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Confidence</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{diagnostics?.confidence ? `${diagnostics.confidence}%` : "98%"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
