"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface PanelConfig {
  id: string;
  row_index: number;
  col_index: number;
  esp32_id: string;
  rated_voltage: number | null;
  rated_current: number | null;
  panel_width_mm: number | null;
  panel_height_mm: number | null;
}

interface ArrayConfig {
  id: string;
  name: string;
  rows: number;
  cols: number;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  arrays: ArrayConfig[];
}

export default function CustomerConfigPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const { user, role, loading, signOut } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(1);
  const [selectedPanel, setSelectedPanel] = useState<PanelConfig | null>(null);
  const [panels, setPanels] = useState<PanelConfig[]>([]);

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

    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/customers/${params.customerId}`, {
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
          setCustomer(null);
          return;
        }
        setCustomer(payload);
        setRows(payload.arrays?.[0]?.rows || 1);
        setCols(payload.arrays?.[0]?.cols || 1);
      })
      .catch(() => setCustomer(null));
  }, [loading, params.customerId, role, router, user]);

  const createArray = async () => {
    const token = localStorage.getItem("firebase-token");
    if (!token) return;

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/customers/${params.customerId}/arrays`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rows, cols, name: `${customer?.name || "Array"} Array` }),
    });
    const payload = await response.json();
    if (payload.array) {
      const newPanelsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/arrays/${payload.array.id}/panels`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rows, cols }),
      });
      const panelPayload = await newPanelsResponse.json();
      setPanels(panelPayload.panels || []);
    }
  };

  const savePanel = async () => {
    if (!selectedPanel) return;
    const token = localStorage.getItem("firebase-token");
    if (!token) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/panels/${selectedPanel.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        esp32_id: selectedPanel.esp32_id,
        rated_voltage: selectedPanel.rated_voltage,
        rated_current: selectedPanel.rated_current,
        panel_width_mm: selectedPanel.panel_width_mm,
        panel_height_mm: selectedPanel.panel_height_mm,
      }),
    });
  };

  const grid = useMemo(() => {
    return Array.from({ length: rows }, (_, rowIndex) => (
      <div key={rowIndex} className="flex gap-2">
        {Array.from({ length: cols }, (_, colIndex) => {
          const panel = panels.find((item) => item.row_index === rowIndex && item.col_index === colIndex);
          return (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => setSelectedPanel(panel || { id: `temp-${rowIndex}-${colIndex}`, row_index: rowIndex, col_index: colIndex, esp32_id: "", rated_voltage: null, rated_current: null, panel_width_mm: null, panel_height_mm: null })}
              className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-900/80 text-xs text-slate-300"
            >
              {rowIndex + 1}/{colIndex + 1}
            </button>
          );
        })}
      </div>
    ));
  }, [cols, panels, rows]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#0f1117] p-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-orange-400">Customer configuration</p>
          <h1 className="text-2xl font-semibold">{customer?.name || "Customer"}</h1>
        </div>
        <button onClick={() => router.push("/admin/customers")} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Back</button>
        <button
          onClick={() => void signOut()}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-slate-400">Rows</label>
            <input type="number" min="1" value={rows} onChange={(event) => setRows(Number(event.target.value))} className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <label className="text-sm text-slate-400">Cols</label>
            <input type="number" min="1" value={cols} onChange={(event) => setCols(Number(event.target.value))} className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <button onClick={createArray} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold">Create array</button>
          </div>
          <div className="space-y-2">{grid}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Panel settings</h2>
          {selectedPanel ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-400">Slot {selectedPanel.row_index + 1}/{selectedPanel.col_index + 1}</p>
              <input value={selectedPanel.esp32_id} onChange={(event) => setSelectedPanel({ ...selectedPanel, esp32_id: event.target.value })} placeholder="ESP32 ID" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={selectedPanel.panel_width_mm ?? ""} onChange={(event) => setSelectedPanel({ ...selectedPanel, panel_width_mm: Number(event.target.value) })} placeholder="Panel width (mm)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={selectedPanel.panel_height_mm ?? ""} onChange={(event) => setSelectedPanel({ ...selectedPanel, panel_height_mm: Number(event.target.value) })} placeholder="Panel height (mm)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={selectedPanel.rated_voltage ?? ""} onChange={(event) => setSelectedPanel({ ...selectedPanel, rated_voltage: Number(event.target.value) })} placeholder="Rated voltage" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={selectedPanel.rated_current ?? ""} onChange={(event) => setSelectedPanel({ ...selectedPanel, rated_current: Number(event.target.value) })} placeholder="Rated current" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <button onClick={savePanel} className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold">Save panel</button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Select a grid cell to configure that panel.</p>
          )}
        </div>
      </div>
    </div>
  );
}
