"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/lib/toast-context";
import { getLive, getHardwareStatus, LiveData, HardwareStatusData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import Header from "@/components/ui/Header";
import MetricCard from "@/components/ui/MetricCard";
import ErrorState from "@/components/ui/ErrorState";
import {
  Zap,
  Activity,
  Gauge,
  Sun,
  Wifi,
  Grid,
  Edit,
  Calendar,
  ChevronDown,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const SENSOR_LIST = [
  { name: "Voltage (INA219)", key: "voltage", time: "17:39:02" },
  { name: "Current (INA219)", key: "current", time: "17:39:02" },
  { name: "Irradiance (BH1750)", key: "bh1750", time: "17:39:00" },
  { name: "Temperature (BME280)", key: "bme280", time: "17:39:00" },
  { name: "Humidity (BME280)", key: "bme280_h", time: "17:39:00" },
  { name: "RTC (DS3231)", key: "ds3231", time: "17:39:01" },
  { name: "SD Card", key: "sd", time: "17:38:55" },
];

const PANEL_SPECS = [
  { label: "Panel ID", value: "Panel 01" },
  { label: "Model", value: "Kotak KM-P012" },
  { label: "Maximum Power (Pmax)", value: "12 W (±3%)" },
  { label: "Open Circuit Voltage (Voc)", value: "21 V" },
  { label: "Short Circuit Current (Isc)", value: "0.75 A" },
  { label: "Voltage at Max Power (Vmp)", value: "17 V" },
  { label: "Current at Max Power (Imp)", value: "0.70 A" },
  { label: "Location", value: "Solar Array A" },
  { label: "Installation Date", value: "Jan 15, 2026" },
];

const MOCK_GRAPH = [
  { date: "Apr 25", value: 3 },
  { date: "Apr 26", value: 7 },
  { date: "Apr 27", value: 2 },
  { date: "Apr 28", value: 6 },
  { date: "Apr 29", value: 2.5 },
  { date: "May 01", value: 7.5 },
  { date: "May 03", value: 6 },
  { date: "May 04", value: 7.8 },
  { date: "May 07", value: 7.2 },
  { date: "May 10", value: 7.9 },
  { date: "May 13", value: 6.2 },
  { date: "May 16", value: 6.8 },
  { date: "May 19", value: 7.1 },
  { date: "May 22", value: 7.4 },
];

export default function MonitoringPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setConnectionStatus } = useAppContext();
  const { addToast } = useToast();

  const [selectedPanel, setSelectedPanel] = useState("Panel 01");
  const [selectedParam, setSelectedParam] = useState("Power (W)");
  const [timeRange, setTimeRange] = useState("1W");
  const [live, setLive] = useState<LiveData | null>(null);
  const [hardware, setHardware] = useState<HardwareStatusData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const [liveData, hwData] = await Promise.all([getLive(), getHardwareStatus()]);
      if (liveData) setLive(liveData);
      if (hwData) setHardware(hwData);
      setConnectionStatus("live");
      setError(null);
    } catch (e) {
      console.error(e);
      setConnectionStatus("offline");
      setError("Failed to fetch monitoring data.");
    }
  }, [setConnectionStatus]);

  useEffect(() => {
    if (!user) return;
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 5000);
    return () => clearInterval(interval);
  }, [user, fetchMonitoringData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMonitoringData();
    setRefreshing(false);
    addToast("success", "Monitoring data refreshed.");
  };

  const vVal = live?.voltage ?? 17.94;
  const cVal = live?.current ?? 1.95;
  const pVal = live?.power ?? 34.9;
  const irrVal = live?.lux ?? 798.4;

  return (
    <div className="flex min-h-screen bg-[#0b0f17]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* Header */}
        <Header
          title="Monitoring"
          subtitle="Real-time sensor data and system performance"
          selectedPanel={selectedPanel}
          onPanelChange={setSelectedPanel}
          statusBadge={{ text: "Live Data", type: "live" }}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {error && !live ? (
          <ErrorState message={error} onRetry={handleRefresh} />
        ) : (
          <div className="space-y-6">
            {/* 4 Top Cards with percentage change */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                label="Voltage"
                value={vVal.toFixed(2)}
                unit="V"
                icon={<Zap className="w-5 h-5" />}
                color="orange"
                trend="↑ 2.1%"
                subtext="vs last hour"
              />
              <MetricCard
                label="Current"
                value={cVal.toFixed(2)}
                unit="A"
                icon={<Activity className="w-5 h-5" />}
                color="blue"
                trend="↑ 1.3%"
                subtext="vs last hour"
              />
              <MetricCard
                label="Power"
                value={pVal.toFixed(1)}
                unit="W"
                icon={<Gauge className="w-5 h-5" />}
                color="amber"
                trend="↑ 3.7%"
                subtext="vs last hour"
              />
              <MetricCard
                label="Irradiance"
                value={irrVal.toFixed(1)}
                unit="lux"
                icon={<Sun className="w-5 h-5" />}
                color="purple"
                trend="↑ 5.2%"
                subtext="vs last hour"
              />
            </div>

            {/* Parameter Over Time Card */}
            <div className="solar-card p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Parameter Over Time</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time data for selected parameter</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Parameter Select */}
                  <div className="relative">
                    <select
                      value={selectedParam}
                      onChange={(e) => setSelectedParam(e.target.value)}
                      className="bg-[#161c2b] border border-[#232d42] text-white text-xs font-semibold rounded-xl px-3.5 py-2 pr-8 focus:outline-none"
                    >
                      <option value="Power (W)">Power (W)</option>
                      <option value="Voltage (V)">Voltage (V)</option>
                      <option value="Current (A)">Current (A)</option>
                      <option value="Irradiance (lux)">Irradiance (lux)</option>
                    </select>
                  </div>

                  {/* Time Range Pills */}
                  <div className="flex items-center gap-1 bg-[#161c2b] p-1 rounded-xl border border-[#232d42]">
                    {["1H", "6H", "1D", "1W", "1M"].map((range) => (
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
                    <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Custom
                    </button>
                  </div>
                </div>
              </div>

              {/* Area Chart */}
              <div className="w-full pt-2">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={MOCK_GRAPH} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#141a27", borderColor: "#232f45", borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorOrange)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row: Sensor Status & Panel Specs */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Sensor Status Card */}
              <div className="solar-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Sensor Status</h3>
                      <p className="text-xs text-slate-400">Current status of all sensors</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {SENSOR_LIST.map((sensor) => (
                      <div
                        key={sensor.name}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-xs font-semibold text-slate-300">{sensor.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Online
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{sensor.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Panel Specs Card */}
              <div className="solar-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
                        <Grid className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Panel Specs</h3>
                        <p className="text-xs text-slate-400">Technical specifications for the selected panel</p>
                      </div>
                    </div>

                    <button className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {PANEL_SPECS.map((spec) => (
                      <div key={spec.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-slate-400 font-medium">{spec.label}</span>
                        <span className="text-white font-mono font-semibold">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
