"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Grid,
  Cpu,
  Zap,
  Save,
  Trash2,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Layers,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface PanelConfig {
  id: string;
  name?: string;
  esp32_id: string;
  cell_rows?: number;
  cell_cols?: number;
  row_index?: number;
  col_index?: number;
  rated_voltage: number | null;
  rated_current: number | null;
  rated_power: number | null;
  panel_width_mm: number | null;
  panel_height_mm: number | null;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  firebase_uid?: string;
  arrays?: unknown[];
  panels?: PanelConfig[];
}

export default function CustomerConfigPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const { user, role, loading, signOut } = useAuth();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [panels, setPanels] = useState<PanelConfig[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<PanelConfig | null>(null);

  // Modal State for Adding New Panel
  const [isAddPanelModalOpen, setIsAddPanelModalOpen] = useState(false);
  const [newPanelName, setNewPanelName] = useState("");
  const [newEsp32Id, setNewEsp32Id] = useState("");
  const [newCellRows, setNewCellRows] = useState(3);
  const [newCellCols, setNewCellCols] = useState(4);
  const [newRatedVoltage, setNewRatedVoltage] = useState(38.5);
  const [newRatedCurrent, setNewRatedCurrent] = useState(9.8);
  const [newWidthMm, setNewWidthMm] = useState(1650);
  const [newHeightMm, setNewHeightMm] = useState(992);
  const [addingPanel, setAddingPanel] = useState(false);

  // UI feedback state
  const [fetching, setFetching] = useState(true);
  const [savingPanel, setSavingPanel] = useState(false);
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

  const loadCustomerDetail = useCallback(async () => {
    const token = localStorage.getItem("firebase-token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setFetching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/customers/${params.customerId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 401 || res.status === 403) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data) {
        setCustomer(data);
        const pList = data.panels || [];
        setPanels(pList);
        if (pList.length > 0) {
          setSelectedPanel(pList[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching customer detail:", err);
    } finally {
      setFetching(false);
    }
  }, [params.customerId, router]);

  useEffect(() => {
    if (!loading && user && role === "admin" && params.customerId) {
      loadCustomerDetail();
    }
  }, [loading, role, user, params.customerId, loadCustomerDetail]);

  // Handle adding a new physical solar panel
  const handleAddPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("firebase-token");
    if (!token || !params.customerId) return;

    setAddingPanel(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/customers/${params.customerId}/panels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newPanelName.trim() || `Solar Panel #${panels.length + 1}`,
            esp32_id: newEsp32Id.trim() || `esp32-0${panels.length + 1}`,
            cell_rows: newCellRows,
            cell_cols: newCellCols,
            rated_voltage: newRatedVoltage,
            rated_current: newRatedCurrent,
            panel_width_mm: newWidthMm,
            panel_height_mm: newHeightMm,
          }),
        }
      );

      if (res.ok) {
        const payload = await res.json();
        if (payload.panel) {
          setPanels((prev) => [...prev, payload.panel]);
          setSelectedPanel(payload.panel);
          setIsAddPanelModalOpen(false);
          setNewPanelName("");
          setNewEsp32Id("");
          setToastMessage("New Solar Panel successfully added!");
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    } catch (err) {
      console.error("Failed to add panel:", err);
    } finally {
      setAddingPanel(false);
    }
  };

  // Handle saving panel edits
  const handleSavePanelConfig = async () => {
    if (!selectedPanel) return;
    const token = localStorage.getItem("firebase-token");
    if (!token) return;

    setSavingPanel(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/panels/${selectedPanel.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: selectedPanel.name,
            esp32_id: selectedPanel.esp32_id || "",
            cell_rows: selectedPanel.cell_rows,
            cell_cols: selectedPanel.cell_cols,
            rated_voltage: selectedPanel.rated_voltage ? Number(selectedPanel.rated_voltage) : null,
            rated_current: selectedPanel.rated_current ? Number(selectedPanel.rated_current) : null,
            panel_width_mm: selectedPanel.panel_width_mm ? Number(selectedPanel.panel_width_mm) : null,
            panel_height_mm: selectedPanel.panel_height_mm ? Number(selectedPanel.panel_height_mm) : null,
          }),
        }
      );

      if (res.ok) {
        const payload = await res.json();
        const updatedPanel = payload.panel;
        setPanels((prev) => prev.map((p) => (p.id === updatedPanel.id ? updatedPanel : p)));
        setSelectedPanel(updatedPanel);
        setToastMessage(`Configuration for "${updatedPanel.name || "Panel"}" saved!`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save panel:", err);
    } finally {
      setSavingPanel(false);
    }
  };

  // Handle deleting a panel
  const handleDeletePanel = async (panelId: string) => {
    const token = localStorage.getItem("firebase-token");
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/panels/${panelId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const remaining = panels.filter((p) => p.id !== panelId);
        setPanels(remaining);
        if (selectedPanel?.id === panelId) {
          setSelectedPanel(remaining[0] || null);
        }
        setToastMessage("Panel removed.");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to delete panel:", err);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-slate-400">Loading Customer Panel Setup...</p>
        </div>
      </div>
    );
  }

  const totalKW = panels.reduce(
    (acc, p) => acc + (p.rated_power ? p.rated_power / 1000 : 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#0f1117] text-white selection:bg-orange-500 selection:text-white pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0f1117]/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/customers"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Customer Installation</p>
              <h1 className="text-xl font-bold tracking-tight text-white">{customer?.name || "Solar Customer"}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddPanelModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Add New Panel
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

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {toastMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 text-sm">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Customer Installation Summary Bar */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-orange-500/10 p-3 text-orange-400 border border-orange-500/20">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Installed Panels</p>
              <p className="text-2xl font-extrabold text-white">{panels.length} Physical Panels</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/20">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Mapped ESP32 Loggers</p>
              <p className="text-2xl font-extrabold text-white">{panels.filter((p) => p.esp32_id).length} Nodes (1 per panel)</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex items-center gap-4">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400 border border-amber-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Rated Capacity</p>
              <p className="text-2xl font-extrabold text-white">{totalKW.toFixed(2)} kW</p>
            </div>
          </div>
        </div>

        {/* Physical Panels Section */}
        <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
          {/* Left Column: Physical Solar Panels List */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7 backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-orange-500" />
                  Physical Solar Panels Setup
                </h3>
                <p className="text-xs text-slate-400">Select a panel to inspect its ESP32 ID and solar cell matrix layout</p>
              </div>
              <button
                onClick={() => setIsAddPanelModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Panel
              </button>
            </div>

            {panels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center space-y-3">
                <Layers className="mx-auto h-8 w-8 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">No solar panels configured yet for this customer.</p>
                <button
                  onClick={() => setIsAddPanelModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition"
                >
                  <Plus className="h-4 w-4" />
                  Add First Solar Panel
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {panels.map((panel, idx) => {
                  const isSelected = selectedPanel?.id === panel.id;
                  const cRows = panel.cell_rows || 3;
                  const cCols = panel.cell_cols || 4;

                  return (
                    <div
                      key={panel.id}
                      onClick={() => setSelectedPanel(panel)}
                      className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 relative flex flex-col justify-between space-y-4 ${isSelected
                        ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/15 ring-2 ring-orange-500/40"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Panel #{idx + 1}</span>
                          <h4 className="font-bold text-white text-sm">{panel.name || `Panel #${idx + 1}`}</h4>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePanel(panel.id);
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                          title="Delete Panel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* ESP32 Mapping Chip */}
                      <div className="flex items-center justify-between rounded-xl bg-slate-900/90 border border-slate-800/80 px-3 py-2">
                        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400">
                          <Cpu className="h-4 w-4 text-emerald-400" />
                          <span>{panel.esp32_id || "Unmapped ESP32"}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans">1:1 IoT Logger</span>
                      </div>

                      {/* Solar Cell Grid Spec */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-800">
                          <p className="text-[10px] text-slate-400">Cell Matrix</p>
                          <p className="font-mono font-bold text-slate-200">{cRows} × {cCols} ({cRows * cCols} cells)</p>
                        </div>
                        <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-800">
                          <p className="text-[10px] text-slate-400">Rated Power</p>
                          <p className="font-mono font-bold text-orange-400">{panel.rated_power ? `${panel.rated_power} W` : "---"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                        <span>{panel.rated_voltage}V / {panel.rated_current}A</span>
                        <span className="text-orange-400 font-semibold">Inspect Panel →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Panel Detail Inspector & Cell Matrix Diagram */}
          <div className="space-y-6">
            {selectedPanel ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-orange-500" />
                      Panel & Solar Cell Inspector
                    </h3>
                    <p className="text-xs font-mono text-slate-400">ID: {selectedPanel.id}</p>
                  </div>

                </div>

                <div className="space-y-4 text-xs">
                  {/* Panel Name & ESP32 ID */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Solar Panel Name</label>
                    <input
                      type="text"
                      value={selectedPanel.name || ""}
                      onChange={(e) => setSelectedPanel({ ...selectedPanel, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Reporting ESP32 Logger ID (1:1)</label>
                    <div className="relative">
                      <Cpu className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                      <input
                        type="text"
                        placeholder="e.g. esp32-01"
                        value={selectedPanel.esp32_id || ""}
                        onChange={(e) => setSelectedPanel({ ...selectedPanel, esp32_id: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 left-10 pl-10 pr-3 text-sm font-mono text-emerald-400 placeholder-slate-600 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Solar Cell Count Matrix Inputs */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <p className="font-bold text-slate-200 flex items-center gap-2">
                      <Grid className="h-4 w-4 text-orange-500" />
                      Internal Solar Cells Matrix Layout
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Cell Rows</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={selectedPanel.cell_rows || 3}
                          onChange={(e) =>
                            setSelectedPanel({
                              ...selectedPanel,
                              cell_rows: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Cell Columns</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={selectedPanel.cell_cols || 4}
                          onChange={(e) =>
                            setSelectedPanel({
                              ...selectedPanel,
                              cell_cols: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Solar Cell Matrix Diagram */}
                    <div className="pt-2">
                      <p className="text-[11px] text-slate-400 mb-2">
                        Visual Cell Layout Diagram ({(selectedPanel.cell_rows || 3) * (selectedPanel.cell_cols || 4)} Cells inside this Panel):
                      </p>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 overflow-x-auto">
                        <div className="flex flex-col gap-1.5 min-w-max items-center justify-center">
                          {Array.from({ length: selectedPanel.cell_rows || 3 }, (_, r) => (
                            <div key={r} className="flex gap-1.5">
                              {Array.from({ length: selectedPanel.cell_cols || 4 }, (_, c) => (
                                <div
                                  key={`${r}-${c}`}
                                  className="h-7 w-9 rounded-md border border-orange-500/30 bg-gradient-to-br from-blue-900/40 to-slate-900/80 flex items-center justify-center text-[9px] font-mono text-orange-300"
                                >
                                  C{r + 1}.{c + 1}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Electrical Specs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Rated Voltage (Vmp)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 38.5"
                        value={selectedPanel.rated_voltage ?? ""}
                        onChange={(e) =>
                          setSelectedPanel({
                            ...selectedPanel,
                            rated_voltage: e.target.value ? Number(e.target.value) : null,
                            rated_power:
                              e.target.value && selectedPanel.rated_current
                                ? Number((Number(e.target.value) * selectedPanel.rated_current).toFixed(1))
                                : selectedPanel.rated_power,
                          })
                        }
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Rated Current (Imp)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 9.8"
                        value={selectedPanel.rated_current ?? ""}
                        onChange={(e) =>
                          setSelectedPanel({
                            ...selectedPanel,
                            rated_current: e.target.value ? Number(e.target.value) : null,
                            rated_power:
                              e.target.value && selectedPanel.rated_voltage
                                ? Number((selectedPanel.rated_voltage * Number(e.target.value)).toFixed(1))
                                : selectedPanel.rated_power,
                          })
                        }
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>



                  {/* Derived Rated Power */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
                    <span className="text-slate-400">Panel Peak Power:</span>
                    <span className="font-mono font-bold text-orange-400 text-sm">
                      {selectedPanel.rated_voltage && selectedPanel.rated_current
                        ? `${(selectedPanel.rated_voltage * selectedPanel.rated_current).toFixed(1)} W`
                        : "N/A"}
                    </span>
                  </div>

                  <button
                    onClick={handleSavePanelConfig}
                    disabled={savingPanel}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingPanel ? "Saving Changes..." : "Save Panel Configuration"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl text-center space-y-3">
                <Layers className="mx-auto h-8 w-8 text-slate-600" />
                <p className="text-sm font-medium text-slate-400">Select a solar panel to view and edit its configuration.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add New Panel Modal */}
      {isAddPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#13151f] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-white">Add Physical Solar Panel</h3>
              </div>
              <button
                onClick={() => setIsAddPanelModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddPanel} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Panel Name / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Panel #4 - East Roof"
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">ESP32 Logger Node ID (1:1 with Panel)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. esp32-04"
                  value={newEsp32Id}
                  onChange={(e) => setNewEsp32Id(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm font-mono text-emerald-400 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Cell Rows</label>
                  <input
                    type="number"
                    min="1"
                    value={newCellRows}
                    onChange={(e) => setNewCellRows(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Cell Columns</label>
                  <input
                    type="number"
                    min="1"
                    value={newCellCols}
                    onChange={(e) => setNewCellCols(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Rated Voltage (Vmp)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newRatedVoltage}
                    onChange={(e) => setNewRatedVoltage(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Rated Current (Imp)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newRatedCurrent}
                    onChange={(e) => setNewRatedCurrent(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>



              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPanelModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPanel}
                  className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {addingPanel ? "Adding..." : "Add Panel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
