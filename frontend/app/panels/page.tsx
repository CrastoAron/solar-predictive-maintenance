"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getLive, LiveData } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import { Search, Filter, Grid, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

interface PanelItem {
  id: string;
  power: string;
  energy: string;
  health: "Healthy" | "Warning" | "Critical";
  maintenance: string;
}

// 20 Solar Panels generated dynamically / fed with live telemetry
const DEFAULT_PANELS: PanelItem[] = [
  { id: "P-01", power: "8.2 W", energy: "294 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-02", power: "7.9 W", energy: "271 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-03", power: "4.1 W", energy: "143 Wh", health: "Warning", maintenance: "Inspect" },
  { id: "P-04", power: "8.4 W", energy: "291 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-05", power: "2.8 W", energy: "91 Wh",  health: "Critical", maintenance: "Required" },
  { id: "P-06", power: "8.1 W", energy: "276 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-07", power: "8.0 W", energy: "268 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-08", power: "7.8 W", energy: "263 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-09", power: "8.3 W", energy: "279 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-10", power: "8.1 W", energy: "274 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-11", power: "7.9 W", energy: "265 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-12", power: "8.2 W", energy: "280 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-13", power: "8.0 W", energy: "270 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-14", power: "8.3 W", energy: "282 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-15", power: "8.1 W", energy: "275 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-16", power: "8.4 W", energy: "288 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-17", power: "8.0 W", energy: "269 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-18", power: "8.1 W", energy: "273 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-19", power: "7.8 W", energy: "261 Wh", health: "Healthy", maintenance: "82 days" },
  { id: "P-20", power: "8.2 W", energy: "278 Wh", health: "Healthy", maintenance: "82 days" },
];

export default function PanelsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [panels, setPanels] = useState<PanelItem[]>(DEFAULT_PANELS);
  const [filterHealth, setFilterHealth] = useState<string>("All");

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  // Optionally augment live power into panel 1 if backend telemetry is available
  useEffect(() => {
    if (!user) return;
    getLive()
      .then((data: LiveData | null) => {
        if (data?.power) {
          setPanels((prev) =>
            prev.map((p) =>
              p.id === "P-01" ? { ...p, power: `${data.power.toFixed(1)} W` } : p
            )
          );
        }
      })
      .catch(() => {});
  }, [user]);

  const healthyCount = panels.filter((p) => p.health === "Healthy").length;
  const warningCount = panels.filter((p) => p.health === "Warning").length;
  const criticalCount = panels.filter((p) => p.health === "Critical").length;

  const filteredPanels = panels.filter((p) => {
    const matchesSearch = p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterHealth === "All" || p.health === filterHealth;
    return matchesSearch && matchesFilter;
  });

  const getHealthBadge = (health: PanelItem["health"]) => {
    if (health === "Healthy")
      return <span className="text-emerald-500 font-semibold flex items-center gap-1">● Healthy</span>;
    if (health === "Warning")
      return <span className="text-orange-500 font-semibold flex items-center gap-1">● Warning</span>;
    return <span className="text-red-500 font-semibold flex items-center gap-1">● Critical</span>;
  };

  return (
    <AppLayout
      title="Panels"
      description="All connected solar panels"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search panels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ss-input pl-9 py-1.5 text-xs w-48 sm:w-64"
            />
          </div>
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="ss-input py-1.5 px-3 text-xs"
          >
            <option value="All">All Status</option>
            <option value="Healthy">Healthy</option>
            <option value="Warning">Warning</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Panels"
            value={panels.length}
            icon={<Grid className="w-5 h-5" />}
          />
          <StatCard
            label="Healthy"
            value={healthyCount}
            statusText="Normal"
            statusType="healthy"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard
            label="Warning"
            value={warningCount}
            statusText="Inspect"
            statusType="warning"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <StatCard
            label="Critical"
            value={criticalCount}
            statusText="Required"
            statusType="critical"
            icon={<AlertCircle className="w-5 h-5" />}
          />
        </div>

        {/* Panel Layout Grid (Left) + Panel List Table (Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Visual Grid View */}
          <div className="xl:col-span-6 ss-card p-6">
            <h3 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Panel Layout
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {panels.map((panel) => {
                const isWarning = panel.health === "Warning";
                const isCritical = panel.health === "Critical";

                const cardBg = isCritical
                  ? "rgba(239, 68, 68, 0.08)"
                  : isWarning
                  ? "rgba(249, 115, 22, 0.08)"
                  : "var(--card)";

                const cardBorder = isCritical
                  ? "rgba(239, 68, 68, 0.4)"
                  : isWarning
                  ? "rgba(249, 115, 22, 0.4)"
                  : "var(--border)";

                return (
                  <Link
                    key={panel.id}
                    href={`/panels/${panel.id}`}
                    className="p-3 rounded-xl border flex flex-col justify-between transition-all hover:scale-105"
                    style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        {panel.id}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCritical ? "bg-red-500" : isWarning ? "bg-orange-500" : "bg-emerald-500"
                        }`}
                      />
                    </div>
                    <span className="text-xs font-medium mt-2" style={{ color: "var(--text-secondary)" }}>
                      {panel.power}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Panel List Table */}
          <div className="xl:col-span-6 ss-card p-6 overflow-hidden">
            <h3 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Panel List
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>ID</th>
                    <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Current Power</th>
                    <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Today's Energy</th>
                    <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Health</th>
                    <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Maintenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {filteredPanels.map((panel) => (
                    <tr
                      key={panel.id}
                      onClick={() => router.push(`/panels/${panel.id}`)}
                      className="cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <td className="py-3 font-bold" style={{ color: "var(--text-primary)" }}>{panel.id}</td>
                      <td className="py-3 font-medium" style={{ color: "var(--text-secondary)" }}>{panel.power}</td>
                      <td className="py-3 font-medium" style={{ color: "var(--text-secondary)" }}>{panel.energy}</td>
                      <td className="py-3">{getHealthBadge(panel.health)}</td>
                      <td className="py-3 font-medium" style={{ color: "var(--text-muted)" }}>{panel.maintenance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
