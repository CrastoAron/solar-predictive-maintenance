"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMaintenance, getPredictions, MaintenanceData, PredictionData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import ErrorState from "@/components/ui/ErrorState";
import { Wrench, Calendar, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingUp className="w-5 h-5 text-emerald-400" />;
  if (trend === "declining") return <TrendingDown className="w-5 h-5 text-red-400" />;
  return <Minus className="w-5 h-5 text-slate-400" />;
}

function trendColor(trend: string) {
  if (trend === "improving") return "text-emerald-400";
  if (trend === "declining") return "text-red-400";
  return "text-slate-400";
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [maint, setMaint] = useState<MaintenanceData | null>(null);
  const [pred, setPred] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [awaitingPrediction, setAwaitingPrediction] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchAll = useCallback(async (canUpdate: () => boolean = () => true) => {
    try {
      const [maintenanceResult, predictionResult] = await Promise.allSettled([
        getMaintenance(),
        getPredictions(),
      ]);
      if (maintenanceResult.status === "rejected") throw maintenanceResult.reason;

      const maintenance = maintenanceResult.value;
      if (!canUpdate()) return;

      if (!maintenance) {
        setMaint(null);
        setPred(null);
        setAwaitingPrediction(true);
        setLastUpdated(new Date());
        setError(null);
        return;
      }

      setMaint(maintenance);
      setPred(predictionResult.status === "fulfilled" ? predictionResult.value : null);
      setAwaitingPrediction(false);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      console.error(e);
      if (canUpdate()) {
        setAwaitingPrediction(false);
        setError(e instanceof Error ? e.message : "Failed to load maintenance data.");
      }
    } finally {
      if (canUpdate()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      await fetchAll(() => !cancelled);
      if (!cancelled) timeoutId = setTimeout(poll, 10_000);
    };

    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, fetchAll, retryToken]);

  const retry = () => {
    setLoading(true);
    setRetryToken((value) => value + 1);
  };

  const daysLeft = maint?.days_remaining;
  const urgency =
    daysLeft === undefined ? "green" : daysLeft <= 7 ? "red" : daysLeft <= 30 ? "amber" : "green";

  const urgencyStyles: Record<string, { ring: string; text: string; bg: string }> = {
    red: { ring: "ring-red-500/30", text: "text-red-400", bg: "from-red-500/10 to-red-500/5" },
    amber: { ring: "ring-amber-500/30", text: "text-amber-400", bg: "from-amber-500/10 to-amber-500/5" },
    green: { ring: "ring-emerald-500/30", text: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
  };
  const u = urgencyStyles[urgency];

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell page-shell-top flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Maintenance</h1>
          <p className="text-slate-400 text-base mt-1">Predictive service schedule</p>
          <p className="text-slate-500 text-sm mt-1">
            {lastUpdated ? `Auto-refresh: ${lastUpdated.toLocaleTimeString()}` : "Auto-refreshing…"}
          </p>
        </div>

        {/* Error state */}
        {error && !loading ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-32 col-span-full rounded-2xl" />
          </div>
        ) : awaitingPrediction ? (
          <div className="glass-card py-20 px-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center">
              <Clock className="w-7 h-7 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Waiting for the first maintenance prediction</p>
              <p className="text-slate-400 text-sm mt-2 max-w-md">
                Send fresh sensor telemetry to InfluxDB. The backend will generate a prediction automatically; this page checks again every 10 seconds.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {maint?.maintenance_trigger && (
              <div className={`rounded-2xl border p-5 ${
                (maint.highest_alert_severity === "high" || maint.days_remaining === 0)
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}>
                <p className="text-sm font-semibold text-white capitalize">
                  {maint.maintenance_trigger}
                </p>
                {maint.alert_message && <p className="text-sm text-slate-300 mt-1">{maint.alert_message}</p>}
              </div>
            )}

            {/* Top cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Countdown */}
              <div
                className={`xl:col-span-2 rounded-2xl border ring-1 ${u.ring} bg-gradient-to-br ${u.bg} p-6 flex items-center gap-5`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Clock className={`w-7 h-7 ${u.text}`} />
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
                    Days Until Maintenance
                  </p>
                  <p className={`text-5xl font-black ${u.text} leading-none`}>{daysLeft ?? "—"}</p>
                  <p className="text-slate-400 text-sm mt-1">days remaining</p>
                </div>
              </div>

              {/* Efficiency trend */}
              <div className="rounded-2xl glass-card p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <TrendIcon trend={maint?.efficiency_trend ?? "stable"} />
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
                    Efficiency Trend
                  </p>
                  <p className={`text-xl font-bold capitalize ${trendColor(maint?.efficiency_trend ?? "stable")}`}>
                    {maint?.efficiency_trend ?? "Stable"}
                  </p>
                  {pred && (
                    <p className="text-slate-400 text-sm mt-1">Score: {pred.efficiency_score.toFixed(1)}%</p>
                  )}
                </div>
              </div>

              {/* Next service */}
              <div className="rounded-2xl glass-card p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-7 h-7 text-orange-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
                    Next Service
                  </p>
                  <p className="text-xl font-bold text-white">{formatDateOnly(maint?.next_service_date)}</p>
                </div>
              </div>

              {/* Panel Health */}
              <div className="rounded-2xl glass-card p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Minus className="w-7 h-7 text-sky-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Panel Health</p>
                  <p className="text-xl font-bold text-white">{maint?.panel_health ?? "—"}</p>
                  <p className="text-slate-400 text-sm mt-1">Damaged: {maint?.panel_damaged === true ? "Yes" : maint?.panel_damaged === false ? "No" : "—"}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    When to clean: {maint?.when_to_clean ? formatDateOnly(maint.when_to_clean) : "Not required now"}
                  </p>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-orange-400" />
                </div>
                <p className="section-title">Recommendation</p>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {maint?.recommendation ?? "No recommendation available at this time."}
              </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
