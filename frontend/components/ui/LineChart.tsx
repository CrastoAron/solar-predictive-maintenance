"use client";

import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";

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
  expectedKey?: string;
  expectedColor?: string;
  showLegend?: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#141a27] border border-[#232f45] rounded-xl p-3 text-xs shadow-2xl z-50">
      <p className="text-slate-400 mb-1.5 font-mono">
        {label ? (() => { try { return format(new Date(label), "MMM d, HH:mm"); } catch { return label; } })() : ""}
      </p>
      {payload.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 my-1">
          <span className="text-slate-300 font-medium capitalize">{item.name || "Value"}:</span>
          <span className="font-bold font-mono" style={{ color: item.color || "#f97316" }}>
            {item.value !== null && item.value !== undefined ? item.value.toFixed(2) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LineChart({
  data,
  xKey = "timestamp",
  yKey = "value",
  color = "#f97316",
  height = 220,
  showGrid = true,
  expectedKey,
  expectedColor = "#94a3b8",
  showLegend = false,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="line"
            wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
          />
        )}
        <Line
          type="monotone"
          name="Actual Power"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: color, stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 }}
        />
        {expectedKey && (
          <Line
            type="monotone"
            name="Expected Power"
            dataKey={expectedKey}
            stroke={expectedColor}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        )}
      </ReLineChart>
    </ResponsiveContainer>
  );
}
