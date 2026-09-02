"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Grid,
  Cpu,
  Zap,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiHeaders } from "@/lib/api-config";

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

    const token = localStorage.getItem("firebase-token");
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
    <div className="min-h-screen bg-[#0f1117] text-white selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0f1117]/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">SolarShield Admin</h1>
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-400 border border-orange-500/30">
                  SYSTEM ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">Solar Fleet Management & Hardware Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-3">

            <button
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-orange-950/30 p-8 shadow-2xl">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Admin Control Panel</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Solar Panel & Cell Matrix Configuration
            </h2>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Manage customer installations, map ESP32 IoT logger nodes to individual panels, and calibrate solar cell matrix counts (rows × columns) and rated specs.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/admin/customers"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-orange-500/40"
              >
                <Users className="h-4 w-4" />
                View Customer Directory
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl transition hover:border-slate-700 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Customers</span>
              <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-400 border border-orange-500/20">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-white">{fetching ? "..." : totalCustomers}</p>
            <p className="mt-1 text-xs text-slate-500">Registered solar accounts</p>
          </div>

          <div className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl transition hover:border-slate-700 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Cell Matrix Setup</span>
              <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400 border border-blue-500/20">
                <Grid className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-white">Active</p>
            <p className="mt-1 text-xs text-slate-500">Solar cell rows × cols matrix</p>
          </div>

          <div className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl transition hover:border-slate-700 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">ESP32 Loggers</span>
              <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-white">1 per Panel</p>
            <p className="mt-1 text-xs text-slate-500">Hardware node telemetry mapping</p>
          </div>

          <div className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl transition hover:border-slate-700 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Rated Hardware Specs</span>
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 border border-amber-500/20">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-white">Calibrated</p>
            <p className="mt-1 text-xs text-slate-500">Per-panel V & I ratings</p>
          </div>
        </div>

        {/* Customer Fleet Preview Table */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Customer Fleet Overview</h3>
              <p className="text-xs text-slate-400">Select a customer to configure panel setup and ESP32 node mapping</p>
            </div>
            <Link
              href="/admin/customers"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              View All ({totalCustomers})
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Account ID</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-medium">
                {fetching ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Loading customer fleet data...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="transition hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-semibold text-white flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-xs font-bold">
                          {c.name ? c.name[0].toUpperCase() : "C"}
                        </div>
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{c.email}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{c.id}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/admin/customers/${c.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 shadow-md shadow-orange-500/20 transition"
                        >
                          <Grid className="h-3.5 w-3.5" />
                          Configure Setup
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
