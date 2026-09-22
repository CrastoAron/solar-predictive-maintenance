"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { useToast } from "@/lib/toast-context";
import { getLive, getHardwareStatus, getExpectedPower, getPanels, LiveData, HardwareStatusData, ExpectedPowerData, PanelData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import Header from "@/components/ui/Header";
import MetricCard from "@/components/ui/MetricCard";
import ErrorState from "@/components/ui/ErrorState";
import {
  Zap,
  Activity,
  Gauge,
  Sun,
  Target,
  Wifi,
  Grid,
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
  { name: "Voltage (INA219)", key: "ina219", time: "17:39:02" },
  { name: "Current (INA219)", key: "ina219", time: "17:39:02" },
  { name: "Irradiance (BH1750)", key: "bh1750", time: "17:39:00" },
  { name: "Temperature (BME280)", key: "bme280", time: "17:39:00" },
  { name: "Humidity (BME280)", key: "bme280", time: "17:39:00" },
  { name: "RTC (DS3231)", key: "ds3231", time: "17:39:01" },
];

const SENSOR_STATUS_LABELS: Record<number, string> = {
  0: "Online",
  1: "Initialization failed",
  2: "Device not found",
  3: "Invalid data",
  4: "Read error",
  5: "Device-specific error",
};

const LIVE_POINT_LIMIT = 60;

const MONITORING_CHART_STYLES: Record<string, { stroke: string; gradientId: string }> = {
  "Power (W)": { stroke: "#f97316", gradientId: "monitoring-gradient-power" },
  "Voltage (V)": { stroke: "#38bdf8", gradientId: "monitoring-gradient-voltage" },
  "Current (A)": { stroke: "#60a5fa", gradientId: "monitoring-gradient-current" },
  "Irradiance (lux)": { stroke: "#facc15", gradientId: "monitoring-gradient-irradiance" },
};

export default function MonitoringPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setConnectionStatus } = useAppContext();
  const { addToast } = useToast();

  const [selectedPanel, setSelectedPanel] = useState("");
  const [selectedParam, setSelectedParam] = useState("Power (W)");
  const [live, setLive] = useState<LiveData | null>(null);
  const [expectedPower, setExpectedPower] = useState<ExpectedPowerData | null>(null);
  const [hardware, setHardware] = useState<HardwareStatusData | null>(null);
  const [liveHistory, setLiveHistory] = useState<{ timestamp: string; value: number }[]>([]);
  const [panels, setPanels] = useState<PanelData[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    setPanelsLoading(true);
    getPanels()
      .then((records) => {
        setPanels(records);
          if (records.length > 0) setSelectedPanel(records[0].name);
        setError(records.length === 0 ? "No solar panels are assigned to this account." : null);
      })
      .catch((requestError) => {
        setPanels([]);
        setError(requestError instanceof Error ? requestError.message : "Unable to load assigned panels.");
      })
      .finally(() => setPanelsLoading(false));
  }, [user]);

  const fetchMonitoringData = useCallback(async () => {
    if (panelsLoading || panels.length === 0 || !selectedPanel) return;
    try {
      const requestId = ++requestIdRef.current;
      const panel = panels.find((candidate) => candidate.name === selectedPanel);
      if (!panel?.esp32_id) {
        setConnectionStatus("offline");
        setError("The selected panel has no telemetry device assigned.");
        return;
      }
      const deviceId = panel.esp32_id;
      const [liveData, hwData, expectedPowerData] = await Promise.all([
        getLive(deviceId),
        getHardwareStatus(deviceId),
        getExpectedPower(deviceId),
      ]);
      if (requestId !== requestIdRef.current) return;
      if (liveData) setLive(liveData);
      if (hwData) setHardware(hwData);
      setExpectedPower(expectedPowerData);
      if (liveData) {
        const value = selectedParam === "Voltage (V)" ? liveData.voltage : selectedParam === "Current (A)" ? liveData.current : selectedParam === "Irradiance (lux)" ? liveData.lux : liveData.power;
        setLiveHistory((points) => [...points, { timestamp: liveData.timestamp, value }].slice(-LIVE_POINT_LIMIT));
      }
      setConnectionStatus("live");
      setError(null);
    } catch (e) {
      console.error("Monitoring request failed:", e);
      setConnectionStatus("offline");
      setError(e instanceof Error ? e.message : "Failed to fetch monitoring data.");
    }
  }, [panels, panelsLoading, selectedPanel, selectedParam, setConnectionStatus]);

  useEffect(() => {
    setLiveHistory([]);
  }, [selectedParam, selectedPanel]);

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

  const vVal = live?.voltage;
  const cVal = live?.current;
  const pVal = live?.power;
  const expectedPowerVal = expectedPower?.expected_power;
  const irrVal = live?.lux;
  const chartStyle = MONITORING_CHART_STYLES[selectedParam] ?? MONITORING_CHART_STYLES["Power (W)"];
  const selectedPanelData = panels.find((panel) => panel.name === selectedPanel);
  const panelSpecs = [
    ["Panel ID", selectedPanelData?.id],
    ["Model", selectedPanelData?.name],
    ["Maximum Power (Pmax)", selectedPanelData?.rated_power],
    ["Rated Voltage (V)", selectedPanelData?.rated_voltage],
    ["Rated Current (A)", selectedPanelData?.rated_current],
    ["Location", selectedPanelData?.setup.name],
  ].map(([label, value]) => ({ label: String(label), value: value == null ? "Unavailable" : String(value) }));

  return (
    <div className="flex min-h-screen bg-[#0b0f17]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        {/* Header */}
        <Header
          title="Monitoring"
          subtitle="Real-time sensor data and system performance"
          selectedPanel={selectedPanel}
          panels={panels}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MetricCard
                label="Voltage"
                value={vVal == null ? "—" : vVal.toFixed(2)}
                unit="V"
                icon={<Zap className="w-5 h-5" />}
                color="orange"
                trend="↑ 2.1%"
                subtext="vs last hour"
              />
              <MetricCard
                label="Current"
                value={cVal == null ? "—" : cVal.toFixed(2)}
                unit="A"
                icon={<Activity className="w-5 h-5" />}
                color="blue"
                trend="↑ 1.3%"
                subtext="vs last hour"
              />
              <MetricCard
                label="Power"
                value={pVal == null ? "—" : pVal.toFixed(1)}
                unit="W"
                icon={<Gauge className="w-5 h-5" />}
                color="amber"
                trend="↑ 3.7%"
                subtext="vs last hour"
              />
              <MetricCard
                label="Expected Power"
                value={expectedPowerVal == null ? "—" : expectedPowerVal.toFixed(1)}
                unit="W"
                icon={<Target className="w-5 h-5" />}
                color="green"
                trend={expectedPower?.operational_status ?? "Not evaluated"}
                subtext="ML baseline"
              />
              <MetricCard
                label="Irradiance"
                value={irrVal == null ? "—" : irrVal.toFixed(1)}
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
                  <p className="text-xs text-slate-400 mt-0.5">Live stream for selected parameter</p>
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

                </div>
              </div>

              {/* Area Chart */}
              <div className="w-full pt-2">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={liveHistory.map((point) => ({ date: point.timestamp, value: point.value }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={chartStyle.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartStyle.stroke} stopOpacity={0.6} />
                        <stop offset="95%" stopColor={chartStyle.stroke} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
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
                    {SENSOR_LIST.map((sensor) => {
                      const sensorValue = hardware?.[sensor.key as keyof HardwareStatusData];
                      const online = typeof sensorValue === "number" ? sensorValue === 0 : false;
                      const statusLabel = typeof sensorValue === "number"
                        ? SENSOR_STATUS_LABELS[sensorValue] ?? "Unknown status"
                        : "Unavailable";
                      return (
                      <div
                        key={sensor.name}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-xs font-semibold text-slate-300">{sensor.name}</span>
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${online ? "text-emerald-400" : "text-amber-400"}`}>
                            <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                            {statusLabel}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{hardware?.timestamp ? new Date(hardware.timestamp).toLocaleTimeString() : "—"}</span>
                        </div>
                      </div>
                      );
                    })}
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

                    {/* <button className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button> */}
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {panelSpecs.map((spec) => (
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
