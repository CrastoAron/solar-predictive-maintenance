"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Grid, Plus, Search, ArrowLeft, LogOut, X, CheckCircle, Mail, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE, apiHeaders } from "@/lib/api-config";
import ThemeSelector from "@/components/ui/ThemeSelector";

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
      const res = await fetch(`${API_BASE}/admin/customers`, {
        method: "POST",
        headers: apiHeaders(token, true),
        body: JSON.stringify({
          name: newCustomerName.trim(),
          email: newCustomerEmail.trim(),
        }),
      });
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
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text-primary)" }}>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b px-6 py-4" style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="w-9 h-9 flex items-center justify-center rounded-xl border transition hover:border-orange-500"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)" }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Customer Fleet Directory
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Manage Solar Accounts & Hardware Configurations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSelector />
            <button
              onClick={() => setIsModalOpen(true)}
              className="ss-btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {toastMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-500 text-xs font-semibold">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ss-input w-full pl-10 text-xs"
            />
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Showing <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{filteredCustomers.length}</span> of {customers.length} customers
          </p>
        </div>

        {/* Customer Table */}
        <div className="ss-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-left text-xs" style={{ borderColor: "var(--border)" }}>
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Customer</th>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Email Address</th>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Provider</th>
                  <th className="px-6 py-4 font-semibold uppercase" style={{ color: "var(--text-muted)" }}>System ID</th>
                  <th className="px-6 py-4 font-semibold uppercase text-right" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium" style={{ borderColor: "var(--border)" }}>
                {fetching ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                      Loading customer database...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                      {searchQuery ? "No matching customers found." : "No customers registered yet. Click 'Add Customer' above."}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="transition hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-6 py-4 font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center font-bold text-sm">
                          {c.name ? c.name[0].toUpperCase() : "C"}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Active Account</p>
                        </div>
                      </td>
                      <td className="px-6 py-4" style={{ color: "var(--text-secondary)" }}>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {c.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium" style={{ color: "var(--text-secondary)" }}>{c.provider || "Google"}</td>
                      <td className="px-6 py-4 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{c.id}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/admin/customers/${c.id}`)}
                          className="ss-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                        >
                          <Grid className="w-3.5 h-3.5" />
                          <span>Configure Array & Panels</span>
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
          <div className="w-full max-w-md rounded-3xl ss-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Add Customer Account</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Customer / Park Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Solar Installation"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="ss-input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. customer@solar.com"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="ss-input w-full"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="ss-btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="ss-btn-primary text-xs"
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
