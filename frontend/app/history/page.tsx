"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getHistory, HistoryPoint } from "@/lib/api";
import NavSidebar from "@/components/ui/NavSidebar";
import { format, subDays } from "date-fns";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

const FIELDS = ["power", "voltage", "current", "temperature", "humidity", "lux"];
const PAGE_SIZE = 25;

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [field, setField] = useState("power");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPage(0);
    try {
      const start = new Date(startDate + "T00:00:00Z").toISOString();
      const end = new Date(endDate + "T23:59:59Z").toISOString();
      const res = await getHistory(start, end, field);
      setData(res.data);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, field]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCSV = () => {
    const header = "timestamp,value\n";
    const rows = data.map((r) => `${r.timestamp},${r.value}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solarpanel-${field}-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <NavSidebar />
      <main className="page-shell flex-1">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">History</h1>
            <p className="text-slate-400 text-sm mt-1">
              {data.length} records · {totalPages} pages
            </p>
          </div>
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
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
                className="bg-[#1c1f2e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                {FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No historical data for selected range.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">
                        #
                      </th>
                      <th className="px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide capitalize">
                        {field}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((row, i) => (
                      <tr
                        key={row.timestamp}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {page * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(row.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-medium">
                          {row.value.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-4 border-t border-white/5">
                <span className="text-xs text-slate-500">
                  Page {page + 1} of {totalPages} · {data.length} total rows
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
