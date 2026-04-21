import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LiveData {
  device_id: string;
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  lux: number;
  temperature: number;
  humidity: number;
}

export interface HistoryPoint {
  timestamp: string;
  value: number;
}

export interface HistoryData {
  field: string;
  data: HistoryPoint[];
}

export interface PredictionData {
  fault_class: number;
  fault_label: string;
  efficiency_score: number;
  maintenance_days: number;
  predicted_at: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface AlertsData {
  alerts: Alert[];
}

export interface MaintenanceData {
  days_remaining: number;
  next_service_date: string;
  efficiency_trend: "improving" | "stable" | "declining";
  recommendation: string;
}

// ── Core fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("No auth token");

    const res = await fetch(API_BASE + path, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      await signOut(auth);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    return (await res.json()) as T;
  } catch (err) {
    if (USE_MOCKS) {
      // When mocks are enabled, pages should provide their own fallbacks if desired.
      console.warn(`[api] ${path} failed — mocks enabled, returning empty result`);
    }
    throw err;
  }
}

// ── Exported API functions ────────────────────────────────────────────────

export const getLive = () => apiFetch<LiveData | null>("/api/live");

export const getHistory = (
  start: string,
  end: string,
  field: string
) =>
  apiFetch<HistoryData>(`/api/history?start=${start}&end=${end}&field=${field}`);

export const getPredictions = () =>
  apiFetch<PredictionData | null>("/api/predictions");

export const getAlerts = () =>
  apiFetch<AlertsData>("/api/alerts");

export const getMaintenance = () =>
  apiFetch<MaintenanceData | null>("/api/maintenance");
