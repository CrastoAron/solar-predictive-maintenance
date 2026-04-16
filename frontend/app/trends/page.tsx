"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getHistory, HistoryPoint } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import LineChart from "@/components/ui/LineChart";
import { format, subDays } from "date-fns";

const FIELDS = ["power", "voltage", "current", "temperature", "humidity", "lux"];

const FIELD_COLORS: Record<string, string> = {
  power: "#f97316",
  voltage: "#3b82f6",
  current: "#8b5cf6",
  temperature: "#ef4444",
  humidity: "#22d3ee",
  lux: "#eab308",
};

export default function TrendsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [field, setField] = useState("power");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate + "T00:00:00Z").toISOString();
      const end = new Date(endDate + "T23:59:59Z").toISOString();
      const res = await getHistory(start, end, field);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, field, startDate, endDate]);

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell flex-1">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Trends</h1>
          <p className="text-slate-400 text-sm mt-1">Historical sensor data</p>
        </div>

        {/* Controls */}
        <div className="glass-card p-5 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase tracking-wide">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Field</label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none pr-8"
              >
                {FIELDS.map((f) => (
                  <option key={f} value={f} className="bg-[#1c1f2e]">
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="section-title capitalize">{field} over time</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.length} data points
              </p>
            </div>
            <span
              className="text-xs font-medium px-3 py-1 rounded-full"
              style={{
                background: `${FIELD_COLORS[field]}20`,
                color: FIELD_COLORS[field],
              }}
            >
              {field}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-56 w-full" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ) : data.length > 0 ? (
            <LineChart
              data={data}
              height={300}
              color={FIELD_COLORS[field] ?? "#f97316"}
            />
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
              No data for selected range.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
