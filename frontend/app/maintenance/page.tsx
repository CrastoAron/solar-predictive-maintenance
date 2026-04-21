"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMaintenance, getPredictions, MaintenanceData, PredictionData } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import { Wrench, Calendar, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [m, p] = await Promise.all([getMaintenance(), getPredictions()]);
        if (cancelled) return;
        setMaint(m);
        setPred(p);
        setLastUpdated(new Date());
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  const daysLeft = maint?.days_remaining ?? pred?.maintenance_days ?? 0;
  const urgency =
    daysLeft <= 7 ? "red" : daysLeft <= 30 ? "amber" : "green";

  const urgencyStyles: Record<string, { ring: string; text: string; bg: string }> = {
    red: { ring: "ring-red-500/30", text: "text-red-400", bg: "from-red-500/10 to-red-500/5" },
    amber: { ring: "ring-amber-500/30", text: "text-amber-400", bg: "from-amber-500/10 to-amber-500/5" },
    green: { ring: "ring-emerald-500/30", text: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
  };
  const u = urgencyStyles[urgency];

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell flex-1">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Maintenance</h1>
          <p className="text-slate-400 text-sm mt-1">Predictive service schedule</p>
          <p className="text-slate-500 text-xs mt-1">
            {lastUpdated ? `Auto-refresh: ${lastUpdated.toLocaleTimeString()}` : "Auto-refreshing…"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-32 col-span-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-6">
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
                  <p className={`text-5xl font-black ${u.text} leading-none`}>{daysLeft}</p>
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
                  <p className="text-xl font-bold text-white">
                    {maint?.next_service_date
                      ? new Date(maint.next_service_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
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

            {/* ML info */}
            {pred && (
              <div className="glass-card p-6">
                <p className="section-title mb-4">ML Prediction Details</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Fault Class", value: pred.fault_class },
                    { label: "Fault Label", value: pred.fault_label },
                    { label: "Efficiency Score", value: `${pred.efficiency_score.toFixed(1)}%` },
                    {
                      label: "Predicted At",
                      value: new Date(pred.predicted_at).toLocaleString(),
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-white font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
