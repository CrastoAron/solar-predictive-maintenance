"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface Customer {
  id: string;
  name: string;
  email: string;
}

export default function AdminCustomersPage() {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);

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
    if (loading || !user || role !== "admin") {
      return;
    }

    const token = localStorage.getItem("firebase-token");
    if (!token) {
      router.replace("/login");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((payload) => {
        if (!payload) {
          setCustomers([]);
          return;
        }
        setCustomers(payload.customers || []);
      })
      .catch(() => setCustomers([]));
  }, [loading, role, router, user]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#0f1117] p-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-orange-400">Admin panel</p>
          <h1 className="text-2xl font-semibold">Customers</h1>
        </div>
        <button
          onClick={() => router.push("/admin/dashboard")}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
        >
          Back to dashboard
        </button>
        <button
          onClick={() => void signOut()}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/80 text-left text-slate-300">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{customer.name}</td>
                <td className="px-4 py-3">{customer.email}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/admin/customers/${customer.id}`)}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white"
                  >
                    Configure
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
