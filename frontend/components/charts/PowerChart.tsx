"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/lib/theme-context";

interface PowerChartProps {
  data: { timestamp: string; value: number }[];
  height?: number;
}

export default function PowerChart({ data, height = 240 }: PowerChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const formattedData = data.map((d) => {
    let timeLabel = d.timestamp;
    try {
      const date = new Date(d.timestamp);
      timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      // fallback
    }
    return {
      time: timeLabel,
      value: d.value,
    };
  });

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            unit=" W"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1a1a26" : "#ffffff",
              borderColor: isDark ? "#2a2a3c" : "#e5e7eb",
              borderRadius: "12px",
              color: isDark ? "#ffffff" : "#111827",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              fontSize: "12px",
            }}
            formatter={(val) => [`${Number(val ?? 0).toFixed(1)} W`, "Power Output"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#f97316"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#powerGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
