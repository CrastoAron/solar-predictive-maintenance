"use client";

import { useEffect, useState } from "react";
import ThemeSelector from "@/components/ui/ThemeSelector";
import { useAppContext } from "@/lib/app-context";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, description, actions }: HeaderProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const { connectionStatus } = useAppContext();

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
      setTimeStr(now.toLocaleTimeString("en-US", { hour12: false }));
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isNormal = connectionStatus === "live";

  return (
    <header
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap self-start sm:self-center">
        {actions}

        {/* Date, Time, Status */}
        <div className="flex items-center gap-3 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          <span>{dateStr}</span>
          <span className="font-mono">{timeStr}</span>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: isNormal ? "var(--success-bg)" : "var(--warning-bg)",
              color: isNormal ? "var(--success)" : "var(--warning)",
            }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isNormal ? "bg-green-500" : "bg-orange-500 animate-pulse"}`} />
            {isNormal ? "Normal" : connectionStatus}
          </div>
        </div>

        {/* Theme Selector */}
        <ThemeSelector />
      </div>
    </header>
  );
}
