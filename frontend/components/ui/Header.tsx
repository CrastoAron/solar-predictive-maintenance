"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Calendar, RefreshCw, Layers } from "lucide-react";
import { format } from "date-fns";

interface HeaderProps {
  title: string;
  subtitle: string;
  selectedPanel?: string;
  onPanelChange?: (panel: string) => void;
  statusBadge?: {
    text: string;
    type?: "normal" | "warning" | "critical" | "live";
  };
  onRefresh?: () => void;
  refreshing?: boolean;
}

const PANELS_LIST = [
  "Panel 01",
  "Panel 02",
  "Panel 03",
  "Panel 04",
  "Panel 05",
  "Panel 06",
  "Panel 07",
  "Panel 08",
  "Panel 09",
  "Panel 10",
];

export default function Header({
  title,
  subtitle,
  selectedPanel = "Panel 01",
  onPanelChange,
  statusBadge,
  onRefresh,
  refreshing = false,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(selectedPanel);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectPanel = (p: string) => {
    setCurrentPanel(p);
    setDropdownOpen(false);
    if (onPanelChange) onPanelChange(p);
  };

  const getBadgeStyle = (type?: string) => {
    switch (type) {
      case "normal":
      case "live":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "critical":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{title}</h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1 font-medium">{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Panel Selector Dropdown */}
        <div className="relative">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1 hidden sm:block">
            Panel
          </div>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-200 text-sm font-medium hover:border-slate-600 transition-colors shadow-sm"
          >
            <Layers className="w-4 h-4 text-orange-400" />
            <span>{currentPanel}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#161c2b] border border-[#232d42] shadow-2xl z-50 py-1 max-h-64 overflow-y-auto animate-fade-in">
              {PANELS_LIST.map((panel) => (
                <button
                  key={panel}
                  onClick={() => handleSelectPanel(panel)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left font-medium transition-colors ${
                    currentPanel === panel
                      ? "bg-orange-500/15 text-orange-400"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {panel}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Date / Time Display */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121824] border border-[#1e293b] text-slate-300 text-xs font-mono">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>
            {now ? format(now, "EEE, MMM d, yyyy HH:mm:ss") : "Thu, Sep 4, 2026 17:39:02"}
          </span>
        </div>

        {/* Status Badge */}
        {statusBadge && (
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold ${getBadgeStyle(statusBadge.type)}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{statusBadge.text}</span>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-[#121824] border border-[#1e293b] hover:border-slate-600 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-orange-400" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
