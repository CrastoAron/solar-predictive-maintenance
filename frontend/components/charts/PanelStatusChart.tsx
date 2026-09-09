"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useTheme } from "@/lib/theme-context";

interface PanelStatusChartProps {
  healthy: number;
  warning: number;
  critical: number;
}

export default function PanelStatusChart({ healthy, warning, critical }: PanelStatusChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const total = healthy + warning + critical;
  const data = [
    { name: "Healthy", value: healthy, color: "#22c55e" },
    { name: "Warning", value: warning, color: "#f97316" },
    { name: "Critical", value: critical, color: "#ef4444" },
  ];

  return (
    <div className="relative w-full h-[180px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={75}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1a1a26" : "#ffffff",
              borderColor: isDark ? "#2a2a3c" : "#e5e7eb",
              borderRadius: "10px",
              color: isDark ? "#ffffff" : "#111827",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
          {total}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Total Panels
        </span>
      </div>
    </div>
  );
}
