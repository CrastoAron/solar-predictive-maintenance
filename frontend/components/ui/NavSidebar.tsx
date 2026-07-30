"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Bell,
  Wrench,
  History,
  LogOut,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/trends",      label: "Trends",      icon: TrendingUp },
  { href: "/alerts",      label: "Alerts",      icon: Bell },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/history",     label: "History",     icon: History },
];

const CONNECTION_CONFIG = {
  live:       { dot: "bg-emerald-400",             label: "Live",        bar: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  offline:    { dot: "bg-red-400",                 label: "Offline",     bar: "bg-red-500/10 text-red-400 border-red-500/20" },
  connecting: { dot: "bg-amber-400 animate-pulse", label: "Connecting…", bar: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export default function NavSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { connectionStatus, criticalAlertCount } = useAppContext();
  const [open, setOpen] = useState(false);

  const conn = CONNECTION_CONFIG[connectionStatus];
  const currentLabel = NAV_ITEMS.find((item) => item.href === pathname)?.label ?? "SolarShield";

  const sidebarContent = (
    <>
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
          <Sun className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base tracking-wide">SolarShield</p>
          <p className="text-slate-500 text-sm">Predictive Maintenance</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setOpen(false)}
          className="ml-auto lg:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Connection status strip ───────────────────────────────────── */}
      <div className={`mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 border text-xs font-medium ${conn.bar}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${conn.dot}`} />
        {conn.label}
      </div>

      {/* ── Nav links ─────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          const isAlerts = href === "/alerts";
          const showBadge = isAlerts && criticalAlertCount > 0;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 group ${
                active
                  ? "bg-orange-500/15 text-orange-400"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  active ? "text-orange-400" : "text-slate-500 group-hover:text-white"
                }`}
              />
              {label}
              <span className="ml-auto flex items-center gap-1.5">
                {showBadge && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
                    {criticalAlertCount > 9 ? "9+" : criticalAlertCount}
                  </span>
                )}
                {active && !showBadge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── User profile + sign out ───────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt="avatar"
              className="w-9 h-9 rounded-full ring-2 ring-orange-500/40"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-sm font-bold">
              {user?.displayName?.[0] ?? "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.displayName ?? "User"}
            </p>
            <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#13151f] border-b border-white/5 flex items-center px-4 gap-3 z-50 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Current page name */}
        <span className="text-white font-semibold text-base tracking-wide">{currentLabel}</span>

        {/* Connection dot — far right */}
        <div className="ml-auto flex items-center gap-2 pr-1">
          <span className={`w-2 h-2 rounded-full ${conn.dot}`} />
          <span className="text-xs text-slate-400">{conn.label}</span>
        </div>
      </header>

      {/* ── Mobile sidebar overlay backdrop ────────────────────────────── */}
      {open && (
        <div
          className="sidebar-overlay animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar drawer ─────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-[#13151f] border-r border-white/5 flex flex-col z-40
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
