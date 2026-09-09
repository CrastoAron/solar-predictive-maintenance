"use client";

import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendType?: "up" | "down" | "neutral";
  statusText?: string;
  statusType?: "healthy" | "warning" | "critical";
  icon?: ReactNode;
  color?: "orange" | "green" | "blue" | "purple" | "red";
}

export default function StatCard({
  label,
  value,
  unit,
  trend,
  trendType = "up",
  statusText,
  statusType = "healthy",
  icon,
}: StatCardProps) {
  const statusColors = {
    healthy: "text-emerald-500 bg-emerald-500/10",
    warning: "text-orange-500 bg-orange-500/10",
    critical: "text-red-500 bg-red-500/10",
  };

  return (
    <div className="ss-card p-5 flex flex-col justify-between transition-all duration-200 hover:border-orange-500/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {value}
            </span>
            {unit && (
              <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                {unit}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-medium">
        {trend && (
          <span
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md ${
              trendType === "up"
                ? "text-emerald-500 bg-emerald-500/10"
                : trendType === "down"
                ? "text-red-500 bg-red-500/10"
                : "text-slate-400 bg-slate-500/10"
            }`}
          >
            {trendType === "up" ? "↑" : trendType === "down" ? "↓" : "•"} {trend}
          </span>
        )}

        {statusText && (
          <span className={`px-2 py-0.5 rounded-md font-semibold ${statusColors[statusType]}`}>
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
}
