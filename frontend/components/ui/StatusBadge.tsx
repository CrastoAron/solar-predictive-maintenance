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
};

export default function StatusBadge({ status, large }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? statusConfig["Degraded"];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring} ${
        large ? "px-5 py-2 text-base font-semibold" : "px-3 py-1 text-xs font-medium"
      }`}
    >
      <span className={`rounded-full flex-shrink-0 ${cfg.dot} ${large ? "w-2.5 h-2.5" : "w-1.5 h-1.5"} animate-pulse`} />
      {cfg.label}
    </span>
  );
}
