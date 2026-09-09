"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Grid, Cpu, Zap, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiHeaders } from "@/lib/api-config";
import ThemeSelector from "@/components/ui/ThemeSelector";

interface Customer {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export default function AdminDashboardPage() {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!loading && role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, role, user, router]);

  useEffect(() => {
    if (loading || !user || role !== "admin") return;

    const token = localStorage.getItem("admin-token");
    if (!token) {
      router.replace("/login");
      return;
    }

    fetch(`${API_BASE}/admin/customers`, {
      headers: apiHeaders(token),
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.customers) {
          setCustomers(data.customers);
        }
      })
      .catch(() => setCustomers([]))
      .finally(() => setFetching(false));
  }, [loading, role, router, user]);

  if (loading) return null;

  const totalCustomers = customers.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text-primary)" }}>
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b px-6 py-4" style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  SolarShield Admin
                </h1>
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-500 border border-orange-500/30">
                  SYSTEM ADMIN
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Solar Fleet Management & Hardware Configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSelector />
            <button
              onClick={() => void signOut()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:border-red-500 hover:text-red-500"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)" }}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Banner Section */}
        <div className="ss-card p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">Admin Control Panel</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Solar Panel & Cell Matrix Configuration
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Manage customer installations, map ESP32 IoT logger nodes to individual panels, and calibrate solar cell matrix counts (rows × columns) and rated specs.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/admin/customers"
                className="ss-btn-primary flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>View Customer Directory</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ss-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Total Customers</span>
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {fetching ? "..." : totalCustomers}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Registered solar accounts</p>
          </div>

          <div className="ss-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Cell Matrix Setup</span>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                <Grid className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>Active</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Solar cell rows × cols matrix</p>
          </div>

          <div className="ss-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>ESP32 Loggers</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Cpu className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>1 per Panel</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Hardware node telemetry mapping</p>
          </div>

          <div className="ss-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Rated Hardware Specs</span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>Calibrated</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Per-panel V & I ratings</p>
          </div>
        </div>

        {/* Customer Fleet Preview Table */}
        <div className="ss-card p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Customer Fleet Overview</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Select a customer to configure panel setup and ESP32 node mapping</p>
            </div>
            <Link
              href="/admin/customers"
              className="ss-btn-ghost text-xs"
            >
              View All ({totalCustomers})
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <table className="min-w-full divide-y text-left text-xs" style={{ borderColor: "var(--border)" }}>
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Customer Name</th>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Email</th>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Account ID</th>
                  <th className="px-6 py-4 font-semibold uppercase text-right" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium" style={{ borderColor: "var(--border)" }}>
                {fetching ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                      Loading customer fleet data...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="transition hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-6 py-4 font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center text-xs font-bold">
                          {c.name ? c.name[0].toUpperCase() : "C"}
                        </div>
                        {c.name}
                      </td>
                      <td className="px-6 py-4" style={{ color: "var(--text-secondary)" }}>{c.email}</td>
                      <td className="px-6 py-4 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{c.id}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/admin/customers/${c.id}`)}
                          className="ss-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                        >
                          <Grid className="w-3.5 h-3.5" />
                          <span>Configure Setup</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
