import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

// ── Mock fallback data ────────────────────────────────────────────────────

const MOCK_LIVE: LiveData = {
  device_id: "esp32-01",
  timestamp: new Date().toISOString(),
  voltage: 18.4,
  current: 2.1,
  power: 38.64,
  lux: 52000,
  temperature: 34.2,
  humidity: 68.5,
};

const MOCK_HISTORY: HistoryData = {
  field: "power",
  data: Array.from({ length: 12 }, (_, i) => ({
    timestamp: new Date(Date.now() - (11 - i) * 5 * 60 * 1000).toISOString(),
    value: 30 + Math.random() * 15,
  })),
};

const MOCK_PREDICTIONS: PredictionData = {
  fault_class: 0,
  fault_label: "Normal",
  efficiency_score: 82.3,
  maintenance_days: 47,
  predicted_at: new Date().toISOString(),
};

const MOCK_ALERTS: AlertsData = {
  alerts: [
    {
      id: "a1",
      type: "fault",
      severity: "high",
      message: "Panel efficiency dropped below 60%",
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      resolved: false,
    },
    {
      id: "a2",
      type: "warning",
      severity: "medium",
      message: "Temperature above 40°C",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      resolved: false,
    },
    {
      id: "a3",
      type: "info",
      severity: "low",
      message: "Voltage slightly below nominal",
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      resolved: true,
    },
  ],
};

const MOCK_MAINTENANCE: MaintenanceData = {
  days_remaining: 47,
  next_service_date: "2025-07-18",
  efficiency_trend: "declining",
  recommendation: "Clean panel surface and check INA219 wiring",
};

// ── Core fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(path: string, mock: T): Promise<T> {
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
  } catch {
    console.warn(`[api] ${path} failed — using mock data`);
    return mock;
  }
}

// ── Exported API functions ────────────────────────────────────────────────

export const getLive = () => apiFetch<LiveData>("/api/live", MOCK_LIVE);

export const getHistory = (
  start: string,
  end: string,
  field: string
) =>
  apiFetch<HistoryData>(
    `/api/history?start=${start}&end=${end}&field=${field}`,
    { field, data: MOCK_HISTORY.data }
  );

export const getPredictions = () =>
  apiFetch<PredictionData>("/api/predictions", MOCK_PREDICTIONS);

export const getAlerts = () =>
  apiFetch<AlertsData>("/api/alerts", MOCK_ALERTS);

export const getMaintenance = () =>
  apiFetch<MaintenanceData>("/api/maintenance", MOCK_MAINTENANCE);
