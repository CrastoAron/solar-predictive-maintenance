"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getHistory, HistoryData } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/ui/StatCard";
import { History, Download, Calendar, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(weekAgo.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [field, setField] = useState("power");
  const [searchQuery, setSearchQuery] = useState("");

  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchHistoryLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistory(
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString(),
        field
      );
      setHistoryData(data);
    } catch (e) {
      console.error(e);
      addToast("error", "Failed to fetch historical telemetry.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, field, addToast]);

  useEffect(() => {
    if (user) fetchHistoryLogs();
  }, [user, fetchHistoryLogs]);

  const handleExportCSV = () => {
    if (!historyData || historyData.data.length === 0) {
      addToast("info", "No history data available for export.");
      return;
    }
    const headers = "Timestamp,Field,Value\n";
    const rows = historyData.data.map((d) => `${d.timestamp},${field},${d.value}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solarshield_history_${field}_${startDate}_${endDate}.csv`;
    a.click();
    addToast("success", "Exported telemetry CSV successfully.");
  };

  const rawData = historyData?.data || [];
  const filteredData = rawData.filter((d) =>
    d.timestamp.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  const unitMap: Record<string, string> = {
    power: "W",
    voltage: "V",
    current: "A",
    irradiance: "W/m²",
    temperature: "°C",
  };

  return (
    <AppLayout
      title="Telemetry Logs & History"
      description="Paginated record of raw sensor telemetry"
      actions={
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:border-orange-500"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-primary)" }}
        >
          <Download className="w-4 h-4 text-orange-500" />
          <span>Export CSV</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Controls Bar */}
        <div className="ss-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <Calendar className="w-4 h-4 text-orange-500" />
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ss-input py-1 px-3 text-xs"
              />
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="ss-input py-1 px-3 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <span>Field:</span>
              <select
                value={field}
                onChange={(e) => { setField(e.target.value); setPage(1); }}
                className="ss-input py-1 px-3 text-xs font-bold text-orange-500 capitalize"
              >
                <option value="power">Power Output (W)</option>
                <option value="voltage">Voltage (V)</option>
                <option value="current">Current (A)</option>
                <option value="irradiance">Irradiance (W/m²)</option>
                <option value="temperature">Temperature (°C)</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search timestamp..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="ss-input pl-9 py-1.5 text-xs w-48 sm:w-64"
            />
          </div>
        </div>

        {/* History Table */}
        <div className="ss-card p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Recorded Telemetry Log
            </h3>
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Total Records: {filteredData.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Timestamp</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Metric</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Recorded Value</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Unit</th>
                  <th className="pb-3 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-3 font-mono font-medium" style={{ color: "var(--text-primary)" }}>
                        {new Date(row.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 font-bold capitalize" style={{ color: "var(--text-primary)" }}>
                        {field}
                      </td>
                      <td className="py-3 font-bold text-orange-500">
                        {row.value.toFixed(2)}
                      </td>
                      <td className="py-3 font-medium" style={{ color: "var(--text-secondary)" }}>
                        {unitMap[field] || ""}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500">
                          ● Normal
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      {loading ? "Loading telemetry records..." : "No records found matching query."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border disabled:opacity-30 transition-all hover:border-orange-500"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--text-primary)" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-xl border disabled:opacity-30 transition-all hover:border-orange-500"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--input-bg)", color: "var(--text-primary)" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
