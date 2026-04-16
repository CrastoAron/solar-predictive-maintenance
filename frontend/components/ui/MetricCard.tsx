"use client";

import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "orange" | "blue" | "green" | "purple";
}

const colorMap = {
  orange: {
    bg: "from-orange-500/10 to-orange-500/5",
    icon: "bg-orange-500/15 text-orange-400",
    value: "text-orange-400",
    border: "border-orange-500/20",
    glow: "shadow-orange-500/10",
  },
  blue: {
    bg: "from-blue-500/10 to-blue-500/5",
    icon: "bg-blue-500/15 text-blue-400",
    value: "text-blue-400",
    border: "border-blue-500/20",
    glow: "shadow-blue-500/10",
  },
  green: {
    bg: "from-emerald-500/10 to-emerald-500/5",
    icon: "bg-emerald-500/15 text-emerald-400",
    value: "text-emerald-400",
    border: "border-emerald-500/20",
    glow: "shadow-emerald-500/10",
  },
  purple: {
    bg: "from-violet-500/10 to-violet-500/5",
    icon: "bg-violet-500/15 text-violet-400",
    value: "text-violet-400",
    border: "border-violet-500/20",
    glow: "shadow-violet-500/10",
  },
};

export default function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendValue,
  color = "orange",
}: MetricCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={`relative rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} backdrop-blur-sm p-5 shadow-xl ${c.glow} overflow-hidden transition-transform duration-200 hover:-translate-y-0.5`}
    >
      {/* Decorative circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/[0.02] border border-white/5" />

      <div className="flex items-start justify-between mb-4">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">
          {label}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1.5">
        <span className={`text-3xl font-bold ${c.value} leading-none`}>
          {typeof value === "number" ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
        </span>
        {unit && <span className="text-slate-400 text-sm mb-0.5">{unit}</span>}
      </div>

      {trendValue && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={`text-xs font-medium ${
              trend === "up"
                ? "text-emerald-400"
                : trend === "down"
                ? "text-red-400"
                : "text-slate-400"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
          <span className="text-slate-500 text-xs">vs last hour</span>
        </div>
      )}
    </div>
  );
}
