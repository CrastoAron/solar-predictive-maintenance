"use client";

import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format } from "date-fns";

// Use a loose object type so HistoryPoint (and similar shapes) are assignable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataPoint = any;

interface LineChartProps {
  data: DataPoint[];
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  formatX?: (val: string) => string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1f2e] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">
        {label ? (() => { try { return format(new Date(label), "MMM d, HH:mm"); } catch { return label; } })() : ""}
      </p>
      <p className="text-orange-400 font-semibold">{payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export default function LineChart({
  data,
  xKey = "timestamp",
  yKey = "value",
  color = "#f97316",
  height = 200,
  showGrid = true,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        )}
        <XAxis
          dataKey={xKey}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => {
            try {
              return format(new Date(v), "HH:mm");
            } catch {
              return v;
            }
          }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: color, stroke: "rgba(255,255,255,0.2)", strokeWidth: 2 }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
