"use client";

import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  color?: "orange" | "blue" | "purple" | "green" | "amber" | "red";
  trend?: string;
  subtext?: string;
}

const COLOR_STYLES = {
  orange: {
    border: "border-orange-500/20",
    bg: "bg-[#141924]",
    iconBg: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    value: "text-orange-400",
    glow: "hover:border-orange-500/40 shadow-orange-900/10",
  },
  blue: {
    border: "border-sky-500/20",
    bg: "bg-[#141924]",
    iconBg: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    value: "text-sky-400",
    glow: "hover:border-sky-500/40 shadow-sky-900/10",
  },
  purple: {
    border: "border-purple-500/20",
    bg: "bg-[#141924]",
    iconBg: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
    value: "text-purple-400",
    glow: "hover:border-purple-500/40 shadow-purple-900/10",
  },
  green: {
    border: "border-emerald-500/20",
    bg: "bg-[#141924]",
    iconBg: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    value: "text-emerald-400",
    glow: "hover:border-emerald-500/40 shadow-emerald-900/10",
  },
  amber: {
    border: "border-amber-500/20",
    bg: "bg-[#141924]",
    iconBg: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    value: "text-amber-400",
    glow: "hover:border-amber-500/40 shadow-amber-900/10",
  },
  red: {
    border: "border-red-500/20",
    bg: "bg-[#141924]",
    iconBg: "bg-red-500/15 text-red-400 border border-red-500/30",
    value: "text-red-400",
    glow: "hover:border-red-500/40 shadow-red-900/10",
  },
};

export default function MetricCard({
  label,
  value,
  unit,
  icon,
  color = "orange",
  trend,
  subtext,
}: MetricCardProps) {
  const style = COLOR_STYLES[color] || COLOR_STYLES.orange;

  return (
    <div
      className={`rounded-2xl ${style.bg} border ${style.border} p-5 flex flex-col justify-between transition-all duration-300 ${style.glow} shadow-lg`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className={`p-2.5 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${style.value}`}>
            {value}
          </span>
          {unit && (
            <span className="text-lg font-bold text-slate-300 uppercase">
              {unit}
            </span>
          )}
        </div>

        {trend && (
          <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
            {trend}
          </p>
        )}

        {subtext && (
          <p className="text-xs text-slate-400 mt-1 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}
