"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AdminDashboardPage() {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && role !== "admin") {
      router.replace("/login");
    }
  }, [loading, role, user, router]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#0f1117] p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-orange-400">Administration</p>
          <h1 className="text-3xl font-semibold">Admin dashboard</h1>
        </div>
        <button
          onClick={() => void signOut()}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <button onClick={() => router.push("/admin/customers")} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-left">
          <h2 className="text-xl font-semibold">Manage customers</h2>
          <p className="mt-2 text-sm text-slate-400">View all customers and configure their panel arrays.</p>
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Panel settings</h2>
          <p className="mt-2 text-sm text-slate-400">Set ESP32 mappings, dimensions, and per-panel rated voltage/current.</p>
        </div>
      </div>
    </div>
  );
}
