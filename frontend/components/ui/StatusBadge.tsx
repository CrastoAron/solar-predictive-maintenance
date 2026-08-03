"use client";

type Status = "Normal" | "Degraded" | "Fault";

interface StatusBadgeProps {
  status: Status | string;
  large?: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; ring: string; label: string }> = {
  Normal: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/30",
    label: "Normal",
  },
  Degraded: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
    ring: "ring-amber-500/30",
    label: "Degraded",
  },
  Fault: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    dot: "bg-red-400",
    ring: "ring-red-500/30",
    label: "Fault",
  },
  Unknown: {
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    dot: "bg-slate-400",
    ring: "ring-slate-500/30",
    label: "Unknown",
  },
  Underperforming: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
    ring: "ring-amber-500/30",
    label: "Underperforming",
  },
  "Strong anomaly": {
    bg: "bg-red-500/15",
    text: "text-red-400",
    dot: "bg-red-400",
    ring: "ring-red-500/30",
    label: "Strong anomaly",
  },
  "Not evaluated (low light)": {
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    dot: "bg-slate-400",
    ring: "ring-slate-500/30",
    label: "Low light",
  },
};

export default function StatusBadge({ status, large }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? statusConfig["Degraded"];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring} ${large ? "px-5 py-2 text-base font-semibold" : "px-3 py-1 text-xs font-medium"
        }`}
    >
      <span className={`rounded-full flex-shrink-0 ${cfg.dot} ${large ? "w-2.5 h-2.5" : "w-1.5 h-1.5"} animate-pulse`} />
      {cfg.label}
    </span>
  );
}
