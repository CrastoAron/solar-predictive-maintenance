"use client";

import { Alert } from "@/lib/api";

const severityConfig = {
  high: { bg: "bg-red-500/10", text: "text-red-400", badge: "bg-red-500/20 text-red-400 ring-red-500/30" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-400 ring-amber-500/30" },
  low: { bg: "bg-emerald-500/10", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30" },
};

interface AlertRowProps {
  alert: Alert;
}

export default function AlertRow({ alert }: AlertRowProps) {
  const cfg = severityConfig[alert.severity] ?? severityConfig.low;

  return (
    <tr className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors`}>
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {new Date(alert.timestamp).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-xs text-slate-300 capitalize">{alert.type}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${cfg.badge}`}
        >
          {alert.severity}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-300">{alert.message}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
            alert.resolved
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
              : "bg-slate-500/10 text-slate-400 ring-slate-500/20"
          }`}
        >
          {alert.resolved ? "Resolved" : "Open"}
        </span>
      </td>
    </tr>
  );
}
