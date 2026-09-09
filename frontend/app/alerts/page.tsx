"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";
import { getAlerts, Alert } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import { Bell, AlertTriangle, Info, Search, ShieldAlert } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function AlertsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setCriticalAlertCount } = useAppContext();
  const { addToast } = useToast();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterType, setFilterType] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedMap, setResolvedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchAlertsData = useCallback(async () => {
    try {
      const data = await getAlerts();
      const list = data?.alerts || [];
      setAlerts(list);
      const criticals = list.filter((a) => a.severity === "high" || a.type === "error").length;
      setCriticalAlertCount(criticals);
    } catch (e) {
      console.error(e);
    }
  }, [setCriticalAlertCount]);

  useEffect(() => {
    if (user) fetchAlertsData();
  }, [user, fetchAlertsData]);

  const toggleResolve = (id: string) => {
    setResolvedMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const currentResolved = next[id];
      addToast(
        currentResolved ? "success" : "info",
        `Alert ${id} marked as ${currentResolved ? "Resolved" : "Active"}.`
      );
      return next;
    });
  };

  const criticalCount = alerts.filter((a) => a.severity === "high" || a.type === "error").length;
  const warningCount = alerts.filter((a) => a.severity === "medium").length;
  const infoCount = alerts.filter((a) => a.severity === "low" || (!a.severity && a.type !== "error")).length;

  const filteredAlerts = alerts.filter((a) => {
    const matchesSearch =
      a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterType === "All" ||
      (filterType === "Critical" && (a.severity === "high" || a.type === "error")) ||
      (filterType === "Warning" && a.severity === "medium") ||
      (filterType === "Info" && (a.severity === "low" || (!a.severity && a.type !== "error")));
    return matchesSearch && matchesFilter;
  });

  return (
    <AppLayout
      title="Alerts & System Notifications"
      description="Real-time predictive maintenance warnings and hardware diagnostics"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ss-input pl-9 py-1.5 text-xs w-48 sm:w-64"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="ss-input py-1.5 px-3 text-xs font-semibold"
          >
            <option value="All">All Severity</option>
            <option value="Critical">Critical</option>
            <option value="Warning">Warning</option>
            <option value="Info">Info</option>
          </select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Active Alerts" value={alerts.length} icon={<Bell className="w-5 h-5" />} />
          <StatCard label="Critical Alerts" value={criticalCount} statusText="Urgent" statusType="critical" icon={<ShieldAlert className="w-5 h-5" />} />
          <StatCard label="Warnings" value={warningCount} statusText="Inspect" statusType="warning" icon={<AlertTriangle className="w-5 h-5" />} />
          <StatCard label="Informational" value={infoCount} icon={<Info className="w-5 h-5" />} />
        </div>

        {/* Alerts List Feed */}
        <div className="ss-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Alert Stream
            </h3>
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Showing {filteredAlerts.length} notifications
            </span>
          </div>

          {filteredAlerts.length > 0 ? (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const isResolved = !!resolvedMap[alert.id];
                const isCritical = alert.severity === "high" || alert.type === "error";
                const isWarning = alert.severity === "medium";

                const icon = isCritical ? (
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                ) : isWarning ? (
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                ) : (
                  <Info className="w-5 h-5 text-blue-500" />
                );

                const borderLeftColor = isCritical ? "#ef4444" : isWarning ? "#f97316" : "#3b82f6";

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      isResolved ? "opacity-50" : ""
                    }`}
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderLeft: `4px solid ${borderLeftColor}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                            {alert.id}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase"
                            style={{
                              backgroundColor: isCritical
                                ? "rgba(239,68,68,0.12)"
                                : isWarning
                                ? "rgba(249,115,22,0.12)"
                                : "rgba(59,130,246,0.12)",
                              color: borderLeftColor,
                            }}
                          >
                            {alert.severity || alert.type || "INFO"}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs font-medium mt-1" style={{ color: "var(--text-primary)" }}>
                          {alert.message}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleResolve(alert.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isResolved
                          ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                          : "border-slate-700 text-slate-300 hover:border-orange-500"
                      }`}
                    >
                      {isResolved ? "✓ Resolved" : "Mark Resolved"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              No alerts match your filter criteria.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
