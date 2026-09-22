"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NavSidebar from "@/components/ui/NavSidebar";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import {
  getAlerts,
  getDiagnostics,
  getExpectedPower,
  getHistory,
  getLive,
  getMaintenance,
  getPanels,
  getPredictions,
  getServiceHistory,
  type Alert,
  type DiagnosticResult,
  type ExpectedPowerData,
  type LiveData,
  type MaintenanceData,
  type PredictionData,
  type MaintenanceTask,
} from "@/lib/api";
import {
  Calendar,
  ChevronRight,
  Activity,
  Wrench,
  Bell,
  CheckCircle2,
  Heart,
  AlertTriangle,
  Shield,
  BarChart3,
  Lightbulb,
  ArrowRight,
  Wifi,
  Zap,
  Target,
  TrendingUp,
  Trophy,
  Layers,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { setCriticalAlertCount, setConnectionStatus } = useAppContext();
  const [panels, setPanels] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [expectedPower, setExpectedPower] = useState<ExpectedPowerData | null>(null);
  const [live, setLive] = useState<LiveData | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [serviceHistory, setServiceHistory] = useState<MaintenanceTask[]>([]);
  const [powerHistory, setPowerHistory] = useState<{ timestamp: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadDashboard = async (initialLoad = false) => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      if (initialLoad) setLoading(true);
      const requests = [
        getPanels().then((value) => { if (!cancelled) setPanels(value.length); }),
        getAlerts().then((value) => {
          if (cancelled) return;
          setAlerts(value.alerts);
          setCriticalAlertCount(value.alerts.filter((alert) => alert.severity === "high" && !alert.resolved).length);
        }),
        getDiagnostics().then((value) => { if (!cancelled) setDiagnostics(value); }),
        getExpectedPower().then((value) => { if (!cancelled) setExpectedPower(value); }),
        // Omitting the range makes the backend query InfluxDB's last 24 hours.
        getHistory(null, null, "power").then((value) => { if (!cancelled) setPowerHistory(value.data); }),
        getLive().then((value) => { if (!cancelled) setLive(value); }),
        getMaintenance().then((value) => { if (!cancelled) setMaintenance(value); }),
        getPredictions().then((value) => { if (!cancelled) setPrediction(value); }),
        getServiceHistory().then((value) => { if (!cancelled) setServiceHistory(value); }),
      ];
      const results = await Promise.allSettled(requests);
      if (!cancelled) {
        setConnectionStatus(results.some((result) => result.status === "fulfilled") ? "live" : "offline");
        setLoading(false);
      }
      refreshInFlight.current = false;
    };

    void loadDashboard(true);
    const refreshTimer = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [user, setConnectionStatus, setCriticalAlertCount]);

  const activeAlerts = alerts.filter((alert) => !alert.resolved);
  const performanceStatus = expectedPower?.operational_status ?? "Not available";
  const health = diagnostics?.health ?? maintenance?.panel_health ?? "Not evaluated";
  const faultLabel = diagnostics?.root_cause ?? prediction?.fault_label ?? "No fault data available";
  const confidence = diagnostics ? `${diagnostics.confidence}%` : "Not available";
  const severity = diagnostics?.severity ?? "Not evaluated";
  const recommendation = diagnostics?.recommendation ?? maintenance?.recommendation ?? "No recommendation available.";
  const energyKwh = (points: { timestamp: string; value: number }[]) => points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const hours = Math.max(0, (Date.parse(point.timestamp) - Date.parse(previous.timestamp)) / 3_600_000);
    return total + ((previous.value + point.value) / 2) * hours / 1000;
  }, 0);
  const actualEnergyKwh = energyKwh(powerHistory);
  const historyHours = powerHistory.length > 1
    ? Math.max(0, (Date.parse(powerHistory[powerHistory.length - 1].timestamp) - Date.parse(powerHistory[0].timestamp)) / 3_600_000)
    : 0;
  const expectedEnergyKwh = expectedPower?.expected_power == null ? null : expectedPower.expected_power * historyHours / 1000;
  const expectedKwh = expectedEnergyKwh == null ? "Not available" : `${expectedEnergyKwh.toFixed(2)} kWh`;
  const actualKwh = powerHistory.length ? `${actualEnergyKwh.toFixed(2)} kWh` : "Not available";
  const performancePercent = expectedEnergyKwh && expectedEnergyKwh > 0 ? `${(((actualEnergyKwh / expectedEnergyKwh) - 1) * 100).toFixed(1)}%` : "Not available";
  const performanceSummaryStatus = expectedEnergyKwh && expectedEnergyKwh > 0
    ? actualEnergyKwh / expectedEnergyKwh >= 0.9 ? "Within range" : "Below expected"
    : "Not available";
  const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not available";
  const lastMaintenance = serviceHistory
    .filter((task) => task.status.toLowerCase() === "completed" && task.completed_date)
    .sort((left, right) => new Date(right.completed_date as string).getTime() - new Date(left.completed_date as string).getTime())[0];
  const formatAlertTime = (value: string) => new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="flex min-h-screen bg-[#0b0f17] text-slate-100 selection:bg-amber-500/30">
      {/* Sidebar Navigation */}
      <NavSidebar />

      {/* Main Dashboard Content Area */}
      <main className="page-shell page-shell-top flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1 font-normal">
              Overview of your solar panel system
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Date Display Pill */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#121927] border border-[#1b263b] text-slate-300 text-sm font-medium shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            </div>

            {/* Online Status Pill */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0c1f19] border border-[#143d2f] text-emerald-400 text-sm font-semibold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{loading ? "Connecting" : live ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Container */}
        <div className="space-y-6">
          {/* ── Top Row: 4 Metric / KPI Cards ────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* Card 1: Panel Count */}
            <div className="p-6 rounded-2xl bg-[#0c1626] border border-[#172a42] shadow-lg flex items-center justify-between transition-all duration-200 hover:border-[#213b5c]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#11263e] border border-[#1c3c63] text-[#38bdf8] flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Layers className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Panel Count</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-3xl font-bold text-white tracking-tight">{loading ? "-" : panels}</span>
                    {/* <ChevronRight className="w-5 h-5 text-slate-400" /> */}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Panels configured</p>
                </div>
              </div>
            </div>

            {/* Card 2: Performance */}
            <div className="p-6 rounded-2xl bg-[#0c1626] border border-[#172a42] shadow-lg flex items-center justify-between transition-all duration-200 hover:border-[#213b5c]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#11263e] border border-[#1c3c63] text-[#38bdf8] flex items-center justify-center flex-shrink-0 shadow-inner">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Performance</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-3xl font-bold text-[#38bdf8] tracking-tight">{performanceStatus}</span>
                    {/* <ChevronRight className="w-5 h-5 text-slate-400" /> */}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Latest expected-power status</p>
                </div>
              </div>
            </div>

            {/* Card 3: Maintenance */}
            <div className="p-6 rounded-2xl bg-[#18140c] border border-[#2e2312] shadow-lg flex items-center justify-between transition-all duration-200 hover:border-[#423118]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#32230e] border border-[#523916] text-[#f59e0b] flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Wrench className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Maintenance</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-3xl font-bold text-[#f59e0b] tracking-tight">{maintenance ? `${maintenance.days_remaining} days` : "-"}</span>
                    {/* <ChevronRight className="w-5 h-5 text-slate-400" /> */}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Until next service</p>
                </div>
              </div>
            </div>

            {/* Card 4: Active Alerts */}
            <div className="p-6 rounded-2xl bg-[#1c1016] border border-[#381a24] shadow-lg flex items-center justify-between transition-all duration-200 hover:border-[#522332]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#38131d] border border-[#5c1e2f] text-[#ef4444] flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Bell className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Active Alerts</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-3xl font-bold text-[#ef4444] tracking-tight">{activeAlerts.length}</span>
                    {/* <ChevronRight className="w-5 h-5 text-slate-400" /> */}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Require attention</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Middle Row: Diagnostics Summary + Recent Alerts ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Box: Diagnostics Summary (7 cols on lg) */}
            <div className="lg:col-span-7 rounded-2xl bg-[#0c1322] border border-[#182438] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#2e1c0d] border border-[#4a2b13] text-[#f97316] flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Diagnostics Summary</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left Column Diagnostic Rows */}
                  <div className="space-y-4">
                    {/* System Health */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <Heart className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-300">System Health</span>
                      </div>
                      <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {health}
                      </span>
                    </div>

                    {/* Likely Cause */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-300">Likely Cause</span>
                      </div>
                      <span className="text-sm font-semibold text-white text-right">{faultLabel}</span>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-300">Confidence</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{confidence}</span>
                    </div>

                    {/* Severity */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-300">Severity</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{severity}</span>
                    </div>
                  </div>

                  {/* Right Column: Recommendation Box */}
                  <div className="md:border-l md:border-white/5 md:pl-6 flex flex-col justify-start">
                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        RECOMMENDATION
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-normal mt-1">
                      {recommendation}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Recent Alerts (5 cols on lg) */}
            <div className="lg:col-span-5 rounded-2xl bg-[#0c1322] border border-[#182438] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#33141a] border border-[#4f1e28] text-red-500 flex items-center justify-center">
                      <Bell className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Recent Alerts</h2>
                  </div>
                  <Link
                    href="/alerts"
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                  >
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <p className="text-sm text-slate-400">No alerts reported.</p>
                  ) : alerts.slice(0, 3).map((alert, index) => (
                    <div key={alert.id} className={`flex items-start justify-between gap-3 ${index < Math.min(alerts.length, 3) - 1 ? "pb-3 border-b border-white/5" : ""}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${alert.severity === "high" ? "bg-red-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-sky-500"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{alert.type}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-medium flex-shrink-0">{formatAlertTime(alert.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom Row: System Health + Performance Summary ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Health Card */}
            <div className="rounded-2xl bg-[#0c1322] border border-[#182438] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">System Health</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {health}
                  </span>
                </div>

                {/* Hero Box inside System Health */}
                <div className="p-4 rounded-2xl bg-[#0b1f19] border border-[#143d2f] flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-400 tracking-tight">
                      {health}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {maintenance?.alert_message ?? diagnostics?.recommendation ?? "Latest system health from backend diagnostics."}
                    </p>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-300 font-medium">Faults detected</span>
                    </div>
                    <span className="font-bold text-white">{prediction?.fault_class ?? "-"}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Wifi className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-300 font-medium">Sensors status</span>
                    </div>
                    <span className={`font-bold ${live ? "text-emerald-400" : "text-slate-400"}`}>{live ? "Online" : "Unavailable"}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-300 font-medium">Last maintenance</span>
                    </div>
                    <span className="font-medium text-white">{formatDate(lastMaintenance?.completed_date)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-300 font-medium">Next maintenance</span>
                    </div>
                    <span className="font-medium text-white">{maintenance ? `${formatDate(maintenance.next_service_date)} (${maintenance.days_remaining} days)` : "Not available"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Summary Card */}
            <div className="rounded-2xl bg-[#0c1322] border border-[#182438] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#11263e] border border-[#1c3c63] text-[#38bdf8] flex items-center justify-center">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Performance Summary</h2>
                  </div>
                  <span className="px-3.5 py-1 rounded-xl text-xs font-semibold bg-[#141d2d] border border-[#212e44] text-slate-300">
                    Today
                  </span>
                </div>

                <div className="space-y-4 text-sm">
                  {/* Energy Generated */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-slate-300 font-medium">Energy generated</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{actualKwh}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {performanceSummaryStatus}
                      </span>
                    </div>
                  </div>

                  {/* Expected Energy */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Target className="w-4 h-4" />
                      </div>
                      <span className="text-slate-300 font-medium">Expected energy</span>
                    </div>
                    <span className="font-bold text-white">{expectedKwh}</span>
                  </div>

                  {/* Performance vs Expected */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <span className="text-slate-300 font-medium">Performance vs expected</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{performancePercent}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {performanceSummaryStatus}
                      </span>
                    </div>
                  </div>

                  {/* Overall Efficiency */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <span className="text-slate-300 font-medium">Overall efficiency</span>
                    </div>
                    <span className="font-bold text-emerald-400">{expectedEnergyKwh && expectedEnergyKwh > 0 ? `${((actualEnergyKwh / expectedEnergyKwh) * 100).toFixed(0)}%` : "Not available"}</span>
                  </div>
                </div>
              </div>

              {/* Subtext footer */}
              <div className="mt-6 pt-4 border-t border-white/5 text-xs text-slate-400 font-normal">
                {maintenance?.recommendation ?? "Performance summary is unavailable until backend data is received."}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
