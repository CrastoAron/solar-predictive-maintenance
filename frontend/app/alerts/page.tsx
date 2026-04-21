"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAlerts, Alert } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import AlertRow from "@/components/ui/AlertRow";
import { Bell } from "lucide-react";

export default function AlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchAlerts = async () => {
      try {
        const d = await getAlerts();
        if (cancelled) return;
        setAlerts(d.alerts);
        setLastUpdated(new Date());
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAlerts();
    const id = setInterval(fetchAlerts, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  const highCount = alerts.filter((a) => a.severity === "high" && !a.resolved).length;
  const openCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell flex-1">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            <p className="text-slate-400 text-sm mt-1">
              {openCount} open · {highCount} critical
            </p>
            <p className="text-slate-500 text-xs mt-1">
              {lastUpdated ? `Auto-refresh: ${lastUpdated.toLocaleTimeString()}` : "Auto-refreshing…"}
            </p>
          </div>
          {highCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <Bell className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-red-400 text-sm font-medium">
                {highCount} critical alert{highCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Summary badges */}
        <div className="flex gap-3 mb-6">
          {(["high", "medium", "low"] as const).map((sev) => {
            const count = alerts.filter((a) => a.severity === sev).length;
            const colors = {
              high: "bg-red-500/10 text-red-400 ring-red-500/20",
              medium: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
              low: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
            };
            return (
              <span
                key={sev}
                className={`px-4 py-1.5 rounded-full text-xs font-medium ring-1 ${colors[sev]}`}
              >
                {count} {sev}
              </span>
            );
          })}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No alerts found. Your system is running smoothly 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Time", "Type", "Severity", "Message", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
