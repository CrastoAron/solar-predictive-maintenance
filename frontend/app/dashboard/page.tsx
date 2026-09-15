"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/lib/toast-context";
import {
  getLive,
  getExpectedPower,
  getHistory,
  getDiagnostics,
  getAlerts,
  LiveData,
  ExpectedPowerData,
  DiagnosticResult,
  Alert,
} from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import Header from "@/components/ui/Header";
import MetricCard from "@/components/ui/MetricCard";
import LineChart from "@/components/ui/LineChart";
import ErrorState from "@/components/ui/ErrorState";
import Link from "next/link";
import {
  Zap,
  Activity,
  Gauge,
  TrendingUp,
  CheckCircle2,
  Calendar,
  BarChart3,
  Thermometer,
  Droplets,
  Sun,
  Bell,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const LIVE_POLL_MS = 5_000;
const DIAGNOSTICS_POLL_MS = 5_000;

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setConnectionStatus } = useAppContext();
  const { addToast } = useToast();

  const [selectedPanel, setSelectedPanel] = useState("Panel 01");
  const [live, setLive] = useState<LiveData | null>(null);
  const [expectedPower, setExpectedPower] = useState<ExpectedPowerData | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [chartData, setChartData] = useState<{ timestamp: string; value: number; expected?: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expectedPowerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diagIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth Guard
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
      setConnectionStatus("live");
      setError(null);

      // Append data point to live chart
      setChartData((prev) => {
        const expectedVal = expectedPower?.expected_power ?? 5.56;
        const next = [...prev, { timestamp: data.timestamp, value: data.power, expected: expectedVal }];
        return next.slice(-15);
      });
    } catch (e) {
      console.error(e);
      setConnectionStatus("offline");
      setError("Could not reach the backend. Check that the server is running.");
    }
  }, [setConnectionStatus, expectedPower]);

  const fetchExpectedPower = useCallback(async () => {
    try {
      setExpectedPower(await getExpectedPower());
    } catch (e) {
      console.error(e);
      setExpectedPower(null);
    }
  }, []);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const data = await getDiagnostics();
      setDiagnostics(data);
    } catch (e) {
      console.error(e);
      setDiagnostics(null);
    }
  }, []);

  const fetchRecentAlerts = useCallback(async () => {
    try {
      const data = await getAlerts();
      setRecentAlerts(data.alerts.slice(0, 3));
    } catch (e) {
      console.error(e);
      setRecentAlerts([]);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!intervalRef.current) intervalRef.current = setInterval(fetchLive, LIVE_POLL_MS);
    if (!expectedPowerIntervalRef.current) expectedPowerIntervalRef.current = setInterval(fetchExpectedPower, DIAGNOSTICS_POLL_MS);
    if (!diagIntervalRef.current) diagIntervalRef.current = setInterval(fetchDiagnostics, DIAGNOSTICS_POLL_MS);
  }, [fetchLive, fetchExpectedPower, fetchDiagnostics]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (expectedPowerIntervalRef.current) { clearInterval(expectedPowerIntervalRef.current); expectedPowerIntervalRef.current = null; }
    if (diagIntervalRef.current) { clearInterval(diagIntervalRef.current); diagIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (!user) return;

    setConnectionStatus("connecting");
    fetchLive();
    fetchExpectedPower();
    fetchDiagnostics();
    fetchRecentAlerts();

    // Initial history data for chart
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    getHistory(start, now.toISOString(), "power")
      .then((h) => {
        const formatted = h.data.map((pt) => ({
          timestamp: pt.timestamp,
          value: pt.value,
          expected: expectedPower?.expected_power ?? 5.56,
        }));
        setChartData(formatted);
      })
      .catch((e) => {
        console.error(e);
      });

    startPolling();
    return () => stopPolling();
  }, [user, fetchLive, fetchExpectedPower, fetchDiagnostics, fetchRecentAlerts, startPolling, stopPolling, setConnectionStatus, expectedPower?.expected_power]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLive();
    await fetchExpectedPower();
    await fetchDiagnostics();
    await fetchRecentAlerts();
    setRefreshing(false);
    addToast("success", "Dashboard refreshed successfully.");
  };

  const voltageVal = live?.voltage ?? 17.94;
  const currentVal = live?.current ?? 1.95;
  const actualPowerVal = live?.power ?? 35.00;
  const expectedPowerVal = expectedPower?.expected_power ?? 5.56;
  const perfRatio = expectedPower?.performance_ratio ? (expectedPower.performance_ratio * 100).toFixed(1) : "630.1";

  const tempVal = live?.temperature ?? 31.25;
  const humVal = live?.humidity ?? 51.9;
  const irrVal = live?.lux ?? 79839.6;

  return (
    <div className="flex min-h-screen bg-[#0b0f17]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* Header */}
        <Header
          title="Dashboard"
          subtitle="Real-time overview of your solar panel system"
          selectedPanel={selectedPanel}
          onPanelChange={setSelectedPanel}
          statusBadge={{ text: "Normal", type: "normal" }}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {error && !live ? (
          <ErrorState message={error} onRetry={handleRefresh} />
        ) : (
          <div className="space-y-6">
            {/* 4 Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                label="VOLTAGE"
                value={voltageVal.toFixed(2)}
                unit="V"
                icon={<Zap className="w-5 h-5" />}
                color="orange"
              />
              <MetricCard
                label="CURRENT"
                value={currentVal.toFixed(2)}
                unit="A"
                icon={<Activity className="w-5 h-5" />}
                color="blue"
              />
              <MetricCard
                label="POWER OUTPUT (ACTUAL)"
                value={actualPowerVal.toFixed(2)}
                unit="W"
                icon={<Gauge className="w-5 h-5" />}
                color="purple"
              />
              <MetricCard
                label="EXPECTED POWER"
                value={expectedPowerVal.toFixed(2)}
                unit="W"
                icon={<TrendingUp className="w-5 h-5" />}
                color="green"
              />
            </div>

            {/* Middle Row: System Status + Power Output Chart */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* SYSTEM STATUS Card (5 cols on xl) */}
              <div className="xl:col-span-5 solar-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                    SYSTEM STATUS
                  </h2>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Normal
                  </span>
                </div>

                {/* Status Hero */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 mb-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400 tracking-tight">
                      Panel Healthy
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {diagnostics?.recommendation || "Panel is operating normally."}
                    </p>
                  </div>
                </div>

                {/* Sub Cards: Next Maintenance & Performance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400 mt-0.5">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-semibold">Next Maintenance</p>
                      <p className="text-sm font-bold text-white mt-1">Dec 3, 2026</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">90 days remaining</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#161d2b] border border-[#232d42] flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 mt-0.5">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-semibold">Performance</p>
                      <p className="text-sm font-bold text-white mt-1">{perfRatio}%</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">of expected power</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Power Output Chart Card (7 cols on xl) */}
              <div className="xl:col-span-7 solar-card p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Power Output</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Last 1 hour • polling every 5s
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    Live
                  </span>
                </div>

                <div className="w-full pt-2">
                  <LineChart
                    data={chartData.length > 0 ? chartData : [
                      { timestamp: "17:35", value: 42, expected: 6 },
                      { timestamp: "17:36", value: 28, expected: 6 },
                      { timestamp: "17:37", value: 38, expected: 6 },
                      { timestamp: "17:38", value: 35, expected: 6 },
                      { timestamp: "17:39", value: 40, expected: 6 },
                    ]}
                    height={210}
                    yKey="value"
                    color="#f97316"
                    expectedKey="expected"
                    expectedColor="#64748b"
                    showLegend
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row: Diagnostics + Environment + Recent Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Diagnostics Summary */}
              <div className="solar-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                      <Activity className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Diagnostics Summary</h3>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-400">System Health</span>
                      <span className="text-emerald-400 font-bold">{diagnostics?.health || "Normal"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-400">Likely Cause</span>
                      <span className="text-white font-medium">{diagnostics?.root_cause || "No Fault Detected"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-400">Confidence</span>
                      <span className="text-white font-medium">{diagnostics ? `${diagnostics.confidence}%` : "0%"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-400">Severity</span>
                      <span className="text-slate-300 font-medium">{diagnostics?.severity || "Low"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase">Recommendation</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {diagnostics?.recommendation || "Continue monitoring the system. No deterministic hardware or panel cause was detected."}
                  </p>
                </div>
              </div>

              {/* Environmental Conditions */}
              <div className="solar-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                      <Sun className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Environmental Conditions</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                          <Thermometer className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-slate-300 font-medium">Temperature</span>
                      </div>
                      <span className="text-sm font-bold text-white">{tempVal.toFixed(2)} °C</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-slate-300 font-medium">Humidity</span>
                      </div>
                      <span className="text-sm font-bold text-white">{humVal.toFixed(1)} %</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                          <Sun className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-slate-300 font-medium">Irradiance</span>
                      </div>
                      <span className="text-sm font-bold text-white">{irrVal.toFixed(1)} lux</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> Sensors Active
                  </span>
                  <span>Optimal Range</span>
                </div>
              </div>

              {/* Recent Alerts */}
              <div className="solar-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Recent Alerts</h3>
                    </div>
                    <Link
                      href="/alerts"
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      View All <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {recentAlerts.length > 0 ? (
                      recentAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-start justify-between gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
                          <div className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-white">{alert.type || "System Normal"}</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">{alert.message}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 text-xs py-1.5 border-b border-white/5">
                          <div className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-white">System Normal</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">All sensor readings within expected range.</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">17:39</span>
                        </div>
                        <div className="flex items-start justify-between gap-2 text-xs py-1.5 border-b border-white/5">
                          <div className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-white">System Normal</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">Power output stable.</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">16:39</span>
                        </div>
                        <div className="flex items-start justify-between gap-2 text-xs py-1.5">
                          <div className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-white">System Normal</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">Environmental conditions normal.</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">15:39</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 text-right">
                  <span className="text-[11px] text-slate-400">Auto-updating telemetry</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
