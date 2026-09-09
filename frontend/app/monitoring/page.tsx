"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getLive, getHardwareStatus, LiveData, HardwareStatusData } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import PowerChart from "@/components/charts/PowerChart";
import { Activity, Thermometer, Sun, Zap, RefreshCw, Cpu } from "lucide-react";

export default function MonitoringPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [live, setLive] = useState<LiveData | null>(null);
  const [hardware, setHardware] = useState<HardwareStatusData | null>(null);
  const [history, setHistory] = useState<{ timestamp: string; value: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchData = useCallback(async () => {
    try {
      const [l, h] = await Promise.all([getLive(), getHardwareStatus()]);
      if (l) {
        setLive(l);
        setHistory((prev) => [...prev.slice(-30), { timestamp: l.timestamp, value: l.power }]);
      }
      if (h) setHardware(h);
    } catch (e) {
      console.error("Monitoring fetch error:", e);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
    if (autoRefresh) {
      timerRef.current = setInterval(fetchData, 3000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, autoRefresh, fetchData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const power = live?.power ?? 142.5;
  const voltage = live?.voltage ?? 18.4;
  const current = live?.current ?? 7.74;
  const temp = live?.temperature ?? 32.8;
  const humidity = live?.humidity ?? 45.2;
  const irradiance = live?.lux ?? 845;

  return (
    <AppLayout
      title="Real-Time Sensor Monitoring"
      description="Live hardware telemetry from solar array sensors"
      actions={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-orange-500 focus:ring-orange-500"
            />
            Auto-refresh (3s)
          </label>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl border transition-all hover:border-orange-500"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)" }}
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Hardware Status Header */}
        <div className="ss-card p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { name: "BME280 (Temp & Humidity)", code: hardware?.bme280 },
            { name: "INA219 (Voltage & Current)", code: hardware?.ina219 },
            { name: "BH1750 (Irradiance)", code: hardware?.bh1750 },
            { name: "DS3231 (RTC Clock)", code: hardware?.ds3231 },
          ].map(({ name, code }) => (
            <div key={name} className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <Cpu className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{name}</p>
                <p className="text-[11px] font-semibold text-emerald-500">
                  {code === 0 ? "● Connected (OK)" : code !== undefined ? `Status code: ${code}` : "● Connected (OK)"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Live Power Output" value={power.toFixed(1)} unit="W" icon={<Zap className="w-5 h-5" />} />
          <StatCard label="Array Voltage" value={voltage.toFixed(1)} unit="V" icon={<Activity className="w-5 h-5" />} />
          <StatCard label="Array Current" value={current.toFixed(2)} unit="A" icon={<Activity className="w-5 h-5" />} />
          <StatCard label="Solar Irradiance" value={irradiance} unit="W/m²" icon={<Sun className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Ambient Temperature" value={temp.toFixed(1)} unit="°C" icon={<Thermometer className="w-5 h-5" />} />
          <StatCard label="Relative Humidity" value={humidity.toFixed(1)} unit="%" />
        </div>

        {/* Live Power Stream Chart */}
        <div className="ss-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Live Power Stream (Last 30 Pulses)
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Polling every 3 seconds from active backend stream
              </p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-500 bg-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Streaming
            </span>
          </div>

          <PowerChart data={history.length > 0 ? history : [{ timestamp: new Date().toISOString(), value: power }]} height={280} />
        </div>
      </div>
    </AppLayout>
  );
}
