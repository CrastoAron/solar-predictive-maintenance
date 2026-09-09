"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMaintenance, getDiagnostics, MaintenanceData, DiagnosticResult } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import { Wrench, AlertTriangle, ShieldCheck, Calendar, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function MaintenancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const [maintenance, setMaintenance] = useState<MaintenanceData | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [scheduledItems, setScheduledItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchData = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([getMaintenance(), getDiagnostics()]);
      setMaintenance(m);
      setDiagnostics(d);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleSchedule = (id: string) => {
    setScheduledItems((prev) => ({ ...prev, [id]: true }));
    addToast("success", `Maintenance dispatch scheduled for ${id}.`);
  };

  const tasks = [
    {
      id: "P-03",
      issue: "Surface Soiling & Dust Accumulation",
      priority: "Medium",
      confidence: "89%",
      recommendation: "Schedule automated cleaning or manual rinse.",
      estLoss: "3.2 W",
    },
    {
      id: "P-05",
      issue: "Voltage Drop / Partial Bypass Diode Failure",
      priority: "High",
      confidence: "94%",
      recommendation: "Inspect junction box and wiring terminals.",
      estLoss: "5.4 W",
    },
    {
      id: "P-12",
      issue: "Minor Micro-cracking Thermal Hotspot",
      priority: "Low",
      confidence: "76%",
      recommendation: "Monitor thermal imaging scan next cycle.",
      estLoss: "0.8 W",
    },
  ];

  return (
    <AppLayout
      title="Predictive Maintenance"
      description="AI-powered failure prediction and service scheduling"
    >
      <div className="space-y-6">
        {/* Top 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Recommended Actions"
            value="2 Urgent"
            statusText="Action Required"
            statusType="warning"
            icon={<Wrench className="w-5 h-5" />}
          />
          <StatCard
            label="System Anomaly Score"
            value="14%"
            statusText="Low Anomaly"
            statusType="healthy"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <StatCard
            label="Estimated Power Loss"
            value="7.6%"
            unit="~9.4 W"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <StatCard
            label="Next Scheduled Routine"
            value="In 14 Days"
            unit="Sep 18"
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>

        {/* AI Insight Banner */}
        <div
          className="ss-card p-6 border-l-4"
          style={{ borderLeftColor: "var(--accent)", backgroundColor: "var(--card)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                AI Diagnostic Summary
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Root cause analysis generated from real-time telemetry models
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
            <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <p style={{ color: "var(--text-muted)" }}>Primary Failure Risk</p>
              <p className="font-bold text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>
                {diagnostics?.root_cause || "Partial Soiling & Module Mismatch"}
              </p>
            </div>
            <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <p style={{ color: "var(--text-muted)" }}>Model Confidence Score</p>
              <p className="font-bold text-sm mt-0.5 text-emerald-500">
                {diagnostics?.confidence ? `${diagnostics.confidence}%` : "94% Confidence"}
              </p>
            </div>
            <div className="p-3 rounded-xl border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <p style={{ color: "var(--text-muted)" }}>AI Action Plan</p>
              <p className="font-bold text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>
                {diagnostics?.recommendation || "Dispatch Technician to Row 1 (P-03 & P-05)"}
              </p>
            </div>
          </div>
        </div>

        {/* Maintenance Schedule Table */}
        <div className="ss-card p-6 overflow-hidden">
          <h3 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Actionable Maintenance Items
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Panel ID</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Issue / Anomaly</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Priority</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Est. Loss</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>AI Recommendation</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {tasks.map((task) => {
                  const isScheduled = !!scheduledItems[task.id];
                  const isHigh = task.priority === "High";

                  return (
                    <tr key={task.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-4 font-bold" style={{ color: "var(--text-primary)" }}>{task.id}</td>
                      <td className="py-4 font-medium" style={{ color: "var(--text-primary)" }}>{task.issue}</td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isHigh ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-4 font-semibold text-red-400">{task.estLoss}</td>
                      <td className="py-4 font-medium" style={{ color: "var(--text-secondary)" }}>{task.recommendation}</td>
                      <td className="py-4">
                        <button
                          onClick={() => handleSchedule(task.id)}
                          disabled={isScheduled}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isScheduled
                              ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                              : "border-orange-500 text-white bg-orange-500 hover:bg-orange-600"
                          }`}
                        >
                          {isScheduled ? "✓ Scheduled" : "Schedule Tech"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
