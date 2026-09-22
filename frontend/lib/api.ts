import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import { API_BASE, apiHeaders } from "./api-config";

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

export interface PanelData {
  id: string;
  name: string;
  esp32_id: string | null;
  array_id: string;
  cell_rows: number;
  cell_cols: number;
  row_index: number;
  col_index: number;
  panel_width_mm: number | null;
  panel_height_mm: number | null;
  rated_voltage: number | null;
  rated_current: number | null;
  rated_power: number | null;
  setup: {
    id: string;
    name: string;
    rows: number;
    cols: number;
  };
}

export interface MaintenanceTask {
  id: string;
  panel_id: string | null;
  task_name: string;
  task_type: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  completed_date?: string | null;
  assigned_to: string | null;
  description: string | null;
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

export interface HardwareStatusData {
  device_id: string;
  timestamp: string;
  bme280: number;
  ina219: number;
  bh1750: number;
  ds3231: number;
}

export interface ExpectedPowerData {
  device_id: string;
  timestamp: string;
  actual_power: number;
  expected_power: number | null;
  performance_ratio: number | null;
  operational_status: "Normal" | "Underperforming" | "Strong anomaly" | "Not evaluated (low light)";
}

export interface DiagnosticResult {
  health: string;
  root_cause: string;
  confidence: number;
  severity: "Low" | "Medium" | "High";
  evidence: string[];
  recommendation: string;
}

export interface MaintenanceData {
  days_remaining: number;
  next_service_date: string | null;
  efficiency_trend: string;
  recommendation: string;
  when_to_clean: string | null;
  panel_damaged: boolean | null;
  panel_health: string | null;
  active_alert_count: number;
  highest_alert_severity: string | null;
  alert_message: string | null;
  maintenance_trigger: string | null;
}

export interface PredictionData {
  fault_class: number;
  fault_label: string;
  efficiency_score: number;
  maintenance_days: number;
  predicted_at: string;
}

// ── Core fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  try {
    const currentAuth = auth;
    const firebaseToken = currentAuth ? await currentAuth.currentUser?.getIdToken() : null;
    const storedFirebaseToken = typeof window !== "undefined" ? localStorage.getItem("firebase-token") : null;
    const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin-token") : null;
    const token = firebaseToken || storedFirebaseToken || adminToken;
    if (!token) throw new Error("No auth token");

    const res = await fetch(API_BASE + path, {
      headers: apiHeaders(token, true),
      // Telemetry must never come from a browser or intermediary cache.
      cache: "no-store",
    });

    if (res.status === 401) {
      if (currentAuth) await signOut(currentAuth);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      let detail = `Request failed: ${res.status}`;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // Keep the HTTP status when the server did not return JSON.
      }
      throw new Error(detail);
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

export const getLive = (deviceId?: string) => {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  return apiFetch<LiveData | null>(`/api/live${params}`);
};

export const getHistory = (
  start: string | null,
  end: string | null,
  field: string,
  deviceId?: string
) => {
  const params = new URLSearchParams({ field });
  if (start && end) {
    params.set("start", start);
    params.set("end", end);
  }
  if (deviceId) params.set("device_id", deviceId);
  return apiFetch<HistoryData>(`/api/history?${params.toString()}`);
};

export const getPanels = () => apiFetch<PanelData[]>("/api/panels");

export const getServiceHistory = () => apiFetch<MaintenanceTask[]>("/api/service-history");

export const getAlerts = () =>
  apiFetch<AlertsData>("/api/alerts");

export const getHardwareStatus = (deviceId?: string) => {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  return apiFetch<HardwareStatusData | null>(`/api/hardware-status${params}`);
};

export const getExpectedPower = (deviceId?: string) => {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  return apiFetch<ExpectedPowerData | null>(`/api/expected-power${params}`);
};

export const getDiagnostics = () =>
  apiFetch<DiagnosticResult | null>("/api/diagnostics");

export const getMaintenance = () =>
  apiFetch<MaintenanceData | null>("/api/maintenance");

export const getPredictions = (deviceId?: string) => {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  return apiFetch<PredictionData | null>(`/api/predictions${params}`);
};
