"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Grid,
  Plus,
  Search,
  ArrowLeft,
  LogOut,
  X,
  CheckCircle,
  Mail,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiHeaders } from "@/lib/api-config";

interface Customer {
  id: string;
  name: string;
  email: string;
  firebase_uid?: string;
  created_at?: string;
  provider?: string;
}

export default function AdminCustomersPage() {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fetching, setFetching] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!loading && role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, role, user, router]);

  const loadCustomers = useCallback(() => {
    const token = localStorage.getItem("admin-token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setFetching(true);
    fetch(`${API_BASE}/admin/customers`, {
      headers: apiHeaders(token),
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((payload) => {
        if (!payload) return;
        setCustomers(payload.customers || []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setFetching(false));
  }, [router]);

  useEffect(() => {
    if (!loading && user && role === "admin") {
      loadCustomers();
    }
  }, [loading, role, user, loadCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerEmail.trim()) return;

    const token = localStorage.getItem("admin-token");
    if (!token) return;

    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/customers`,
        {
          method: "POST",
          headers: apiHeaders(token, true),
          body: JSON.stringify({
            name: newCustomerName.trim(),
            email: newCustomerEmail.trim(),
          }),
        }
      );
      if (res.ok) {
        setNewCustomerName("");
        setNewCustomerEmail("");
        setIsModalOpen(false);
        setToastMessage("Customer account successfully created!");
        setTimeout(() => setToastMessage(null), 4000);
        loadCustomers();
      }
    } catch (err) {
      console.error("Failed to create customer:", err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f1117] text-white selection:bg-orange-500 selection:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0f1117]/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Customer Fleet Directory
              </h1>
              <p className="text-xs text-slate-400">Manage Solar Accounts & Hardware Configurations</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {toastMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 text-sm">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-2.5 left-10 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">{filteredCustomers.length}</span> of {customers.length} customers
          </p>
        </div>

        {/* Customer Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Email Address</th>
                  <th className="px-6 py-4">Provider</th>
                  <th className="px-6 py-4">System ID</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {fetching ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading customer database...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      {searchQuery ? "No matching customers found." : "No customers registered yet. Click 'Add Customer' above."}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="transition hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-semibold text-white flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm">
                          {c.name ? c.name[0].toUpperCase() : "C"}
                        </div>
                        <div>
                          <p className="font-bold text-white">{c.name}</p>
                          <p className="text-xs text-slate-500">Active Account</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          {c.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{c.id}</td>
                                            <td className="px-6 py-4 text-slate-300">{c.provider || "Google"}</td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{c.id}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/admin/customers/${c.id}`)}
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 shadow-md shadow-orange-500/20 transition"
                        >
                          <Grid className="h-4 w-4" />
                          Configure Array & Panels
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

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#13151f] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-white">Add Customer Account</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Customer / Park Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Solar Installation"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. customer@solar.com"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
