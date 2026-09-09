"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getExpectedPower, getDiagnostics, ExpectedPowerData, DiagnosticResult } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import PowerChart from "@/components/charts/PowerChart";
import { ArrowLeft, AlertTriangle, CheckCircle2, Wrench, Activity, ChevronRight } from "lucide-react";

export default function PanelDetailsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const panelId = (params?.id as string) || "P-03";

  const [activeTab, setActiveTab] = useState("Overview");
  const [expectedPower, setExpectedPower] = useState<ExpectedPowerData | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    getExpectedPower().then(setExpectedPower).catch(() => {});
    getDiagnostics().then(setDiagnostics).catch(() => {});
  }, [user]);

  // Mock 7-day trend history matching the reference screenshot
  const mock7DayHistory = [
    { timestamp: "Aug 28", value: 4.1 },
    { timestamp: "Aug 29", value: 7.8 },
    { timestamp: "Aug 30", value: 8.0 },
    { timestamp: "Aug 31", value: 7.5 },
    { timestamp: "Sep 01", value: 8.2 },
    { timestamp: "Sep 02", value: 7.9 },
    { timestamp: "Sep 03", value: 4.1 },
  ];

  const status = panelId === "P-05" ? "Critical" : panelId === "P-03" ? "Warning" : "Healthy";
  const perfScore = panelId === "P-03" ? "52.5%" : "96.2%";

  return (
    <AppLayout
      title={`Panel Details - ${panelId}`}
      description="Detailed performance diagnostics and telemetry"
      actions={
        <Link
          href="/panels"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:border-orange-500"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Panels</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Top Summary Banner — Match Screenshot */}
        <div className="ss-card p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          <div className="flex items-center gap-4 border-r pr-6" style={{ borderColor: "var(--border)" }}>
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{panelId}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Solar Panel</p>
              <p className="text-xs font-semibold text-orange-500 mt-0.5">⚠️ Performance Below Expected</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>Current Power</p>
            <p className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>4.1 W</p>
          </div>

          <div>
            <p className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>Expected Power</p>
            <p className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>7.8 W</p>
          </div>

          <div>
            <p className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>Performance</p>
            <p className="text-2xl font-black text-orange-500 mt-1">{perfScore}</p>
          </div>

          <div>
            <p className="text-xs uppercase font-semibold" style={{ color: "var(--text-muted)" }}>Today's Generation</p>
            <p className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>143 Wh</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
          {["Overview", "Diagnostics", "Trends", "Maintenance", "Sensor Data"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px ${
                activeTab === tab ? "border-orange-500 text-orange-500" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab Content */}
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: 7-Day Power Chart */}
            <div className="xl:col-span-2 ss-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Power Output (Last 7 Days)
                </h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}>
                  7 Days
                </span>
              </div>
              <PowerChart data={mock7DayHistory} height={260} />
            </div>

            {/* Right Column: Panel Info + Quick Actions */}
            <div className="space-y-6">
              <div className="ss-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                  Panel Information
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Panel ID</span>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>{panelId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Status</span>
                    <span className="font-bold text-orange-500">{status}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Installation Date</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>Jan 15, 2026</span>
                  </div>
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Panel Type</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>Monocrystalline</span>
                  </div>
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Rated Power</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>12 W</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span style={{ color: "var(--text-secondary)" }}>Location</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>Row 1, Column 3</span>
                  </div>
                </div>
              </div>

              <div className="ss-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab("Diagnostics")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all hover:border-orange-500/40"
                    style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                  >
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-500" />
                      View Diagnostics
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => router.push("/maintenance")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all hover:border-orange-500/40"
                    style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                  >
                    <span className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-orange-500" />
                      Schedule Maintenance
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs Placeholder */}
        {activeTab !== "Overview" && (
          <div className="ss-card p-8 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
            <p className="font-bold text-sm text-orange-500 mb-2">{activeTab} Details for {panelId}</p>
            <p>Root Cause: {diagnostics?.root_cause || "Performance degradation detected under partial shading/soiling."}</p>
            <p className="mt-1">Recommendation: {diagnostics?.recommendation || "Inspect surface for dust or micro-cracks."}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
