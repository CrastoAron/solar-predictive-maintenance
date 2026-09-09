"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Grid,
  TrendingUp,
  Bell,
  Wrench,
  Activity,
  History,
  LogOut,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/panels", label: "Panels", icon: Grid },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/history", label: "History", icon: History },
];

const CONNECTION_CONFIG = {
  live: { dot: "bg-emerald-500", label: "Live", text: "text-emerald-500" },
  offline: { dot: "bg-red-500", label: "Offline", text: "text-red-500" },
  connecting: { dot: "bg-amber-500 animate-pulse", label: "Connecting…", text: "text-amber-500" },
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { connectionStatus, criticalAlertCount } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const conn = CONNECTION_CONFIG[connectionStatus] || CONNECTION_CONFIG.live;

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Brand Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20 flex-shrink-0">
            <Sun className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
              SolarShield
            </h1>
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Predictive Maintenance
            </p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Indicator */}
        <div className="mt-4 flex items-center gap-2 px-1 text-xs font-semibold">
          <span className={`w-2 h-2 rounded-full ${conn.dot}`} />
          <span className={conn.text}>{conn.label}</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const isAlerts = href === "/alerts";
          const showBadge = isAlerts && criticalAlertCount > 0;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active ? "active font-semibold" : ""
              }`}
              style={{
                backgroundColor: active ? "var(--accent-bg)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0 transition-colors"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {criticalAlertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile & Sign Out */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full ring-2 ring-orange-500/30" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-xs">
              {user?.displayName?.[0] || user?.email?.[0] || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {user?.displayName || "Aron Preston Crasto"}
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {user?.email || "23a30.aron@sjec.ac.in"}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:text-red-500"
          style={{ color: "var(--text-muted)" }}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Bar */}
      <header
        className="fixed top-0 left-0 right-0 h-14 border-b flex items-center justify-between px-4 z-40 lg:hidden"
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}
      >
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg" style={{ color: "var(--text-primary)" }}>
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>SolarShield</span>
        <div className="w-6" />
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-full h-full z-10 animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
