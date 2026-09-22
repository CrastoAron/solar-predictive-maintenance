"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  LayoutGrid,
  TrendingUp,
  Bell,
  Activity,
  History,
  LogOut,
  Sun,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAppContext } from "@/lib/app-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/panels", label: "Panels", icon: LayoutGrid },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: true },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/history", label: "History", icon: History },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { criticalAlertCount } = useAppContext();
  const [open, setOpen] = useState(false);

  const currentLabel =
    NAV_ITEMS.find((item) => item.href === pathname)?.label ?? "SolarShield";

  const sidebarContent = (
    <>
      {/* ── Brand Logo Header ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
          <Sun className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base tracking-tight leading-tight">
            SolarShield
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            Predictive Maintenance
          </p>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={() => setOpen(false)}
          className="ml-auto lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Navigation Links ─────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${active
                  ? "bg-orange-500/15 text-orange-400 border border-orange-500/20 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${active
                    ? "text-orange-400"
                    : "text-slate-400 group-hover:text-slate-200"
                  }`}
              />

              <span className="flex-1">{label}</span>

              {/* Alert Badge Counter */}
              {badge && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center leading-none ${criticalAlertCount > 0
                      ? "bg-red-500 text-white"
                      : "bg-orange-500/20 text-orange-400"
                    }`}
                >
                  {criticalAlertCount > 0
                    ? criticalAlertCount > 9
                      ? "9+"
                      : criticalAlertCount
                    : "2"}
                </span>
              )}

              {/* Active Arrow Indicator */}
              {active && !badge && (
                <ChevronRight className="w-4 h-4 text-orange-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile & Sign Out ──────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-white/5 bg-[#0e121b]/60">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt="avatar"
              className="w-10 h-10 rounded-full ring-2 ring-orange-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-md">
              {user?.displayName?.[0] ?? "A"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">
              {user?.displayName ?? "Aron Preston Crasto"}
            </p>
            <p className="text-slate-400 text-[11px] truncate">
              {user?.email ?? "23a30.aron@sjec.ac.in"}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile Top Bar Header ───────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0e131c] border-b border-white/5 flex items-center px-4 gap-3 z-50 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="text-white font-bold text-sm tracking-wide">
          {currentLabel}
        </span>
      </header>

      {/* ── Mobile Overlay Backdrop ─────────────────────────────────── */}
      {open && (
        <div
          className="sidebar-overlay animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar Container ────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-[#0d121c] border-r border-[#1a2232] flex flex-col z-40
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}