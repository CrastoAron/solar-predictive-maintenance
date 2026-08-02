from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID, EFFICIENCY_ALERT_MAX_SCORE, FAULT_ALERT_MIN_CLASS
from dependencies import get_current_user
from models.schemas import MaintenanceResponse
from diagnostics import run_diagnostics
from services.influx_client import get_influx_client

router = APIRouter()


def _trend_label(values: list[float]) -> str:
    if len(values) < 2:
        return "unknown"
    start = values[0]
    end = values[-1]
    if end < start:
        return "declining"
    if end > start:
        return "improving"
    return "stable"


@router.get("/api/maintenance", response_model=MaintenanceResponse | None)
async def get_maintenance(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    latest = influx.get_latest_prediction(device_id=device_id)
    if not latest:
        return None

    # Gather latest telemetry and recent history for diagnostics
    latest_sensor = influx.get_latest_sensor(device_id=device_id)
    recent_sensor_history_df = influx.get_raw_data_last_minutes(device_id=device_id, minutes=30)
    recent_sensor_history = [
        {
            "timestamp": row["timestamp"].isoformat().replace("+00:00", "Z") if hasattr(row["timestamp"], "isoformat") else row["timestamp"],
            "voltage": row["voltage"],
            "current": row["current"],
            "power": row["power"],
            "lux": row["lux"],
            "temperature": row["temperature"],
            "humidity": row["humidity"],
        }
        for _, row in recent_sensor_history_df.iterrows()
    ]

    latest_hardware_status = influx.get_latest_hardware_status(device_id)
    try:
        diagnostics = run_diagnostics(
            latest_telemetry=latest_sensor or {},
            historical_telemetry=recent_sensor_history,
            ml_prediction=latest,
            hardware_status=latest_hardware_status,
        )
    except Exception:
        diagnostics = None

    now_utc = datetime.now(timezone.utc)

    days_remaining = int(latest["maintenance_days"])
    next_service_date = (now_utc + timedelta(days=days_remaining)).date().isoformat()

    try:
        scores = influx.get_efficiency_scores_last(device_id=device_id, limit=6)
    except Exception:
        scores = []
    trend = _trend_label([row["value"] for row in scores])

    fault_class = int(latest["fault_class"])
    efficiency_score = float(latest["efficiency_score"])

    if fault_class >= FAULT_ALERT_MIN_CLASS or efficiency_score < EFFICIENCY_ALERT_MAX_SCORE:
        recommendation = "Clean panel surface and check INA219 wiring"
    else:
        recommendation = "System operating normally. Continue monitoring solar panel performance."

    # Diagnostics-informed fields
    panel_health = None
    panel_damaged = None
    when_to_clean = None

    if diagnostics is not None:
        try:
            panel_health = diagnostics.health
            # Mark damaged if diagnostics severity high or root cause mentions damage
            root = (diagnostics.root_cause or "").lower()
            if diagnostics.severity == "High" or "damage" in root:
                panel_damaged = True
            else:
                panel_damaged = False

            # If diagnostics recommends cleaning, surface the maintenance date
            if diagnostics.recommendation and "clean" in diagnostics.recommendation.lower():
                when_to_clean = next_service_date

            # Prefer diagnostics recommendation when available
            if diagnostics.recommendation:
                recommendation = diagnostics.recommendation
        except Exception:
            # Ignore diagnostics failures and fall back to ML-derived values
            panel_health = None
            panel_damaged = None
            when_to_clean = None

    return MaintenanceResponse(
        days_remaining=days_remaining,
        next_service_date=next_service_date,
        efficiency_trend=trend,
        recommendation=recommendation,
        when_to_clean=when_to_clean,
        panel_damaged=panel_damaged,
        panel_health=panel_health,
    )


@router.get("/api/_debug/maintenance", response_model=MaintenanceResponse | None)
async def debug_get_maintenance(device_id: str = Query(default=DEFAULT_DEVICE_ID)):
    """Debug-only: returns the same payload as `/api/maintenance` but without requiring auth.
    Use this locally to verify backend behavior when frontend auth may be the issue.
    """
    influx = get_influx_client()
    latest = influx.get_latest_prediction(device_id=device_id)
    if not latest:
        return None

    now_utc = datetime.now(timezone.utc)
    days_remaining = int(latest["maintenance_days"])
    next_service_date = (now_utc + timedelta(days=days_remaining)).date().isoformat()

    try:
        scores = influx.get_efficiency_scores_last(device_id=device_id, limit=6)
    except Exception:
        scores = []
    trend = _trend_label([row["value"] for row in scores])

    fault_class = int(latest["fault_class"])
    efficiency_score = float(latest["efficiency_score"])

    if fault_class >= FAULT_ALERT_MIN_CLASS or efficiency_score < EFFICIENCY_ALERT_MAX_SCORE:
        recommendation = "Clean panel surface and check INA219 wiring"
    else:
        recommendation = "System operating normally. Continue monitoring solar panel performance."

    # Diagnostics-informed fields (best-effort)
    latest_sensor = influx.get_latest_sensor(device_id=device_id)
    recent_sensor_history_df = influx.get_raw_data_last_minutes(device_id=device_id, minutes=30)
    recent_sensor_history = [
        {
            "timestamp": row["timestamp"].isoformat().replace("+00:00", "Z") if hasattr(row["timestamp"], "isoformat") else row["timestamp"],
            "voltage": row["voltage"],
            "current": row["current"],
            "power": row["power"],
            "lux": row["lux"],
            "temperature": row["temperature"],
            "humidity": row["humidity"],
        }
        for _, row in recent_sensor_history_df.iterrows()
    ]
    latest_hardware_status = influx.get_latest_hardware_status(device_id)
    try:
        diagnostics = run_diagnostics(
            latest_telemetry=latest_sensor or {},
            historical_telemetry=recent_sensor_history,
            ml_prediction=latest,
            hardware_status=latest_hardware_status,
        )
    except Exception:
        diagnostics = None

    panel_health = None
    panel_damaged = None
    when_to_clean = None
    if diagnostics is not None:
        try:
            panel_health = diagnostics.health
            root = (diagnostics.root_cause or "").lower()
            if diagnostics.severity == "High" or "damage" in root:
                panel_damaged = True
            else:
                panel_damaged = False
            if diagnostics.recommendation and "clean" in diagnostics.recommendation.lower():
                when_to_clean = next_service_date
            if diagnostics.recommendation:
                recommendation = diagnostics.recommendation
        except Exception:
            panel_health = None
            panel_damaged = None
            when_to_clean = None

    return MaintenanceResponse(
        days_remaining=days_remaining,
        next_service_date=next_service_date,
        efficiency_trend=trend,
        recommendation=recommendation,
        when_to_clean=when_to_clean,
        panel_damaged=panel_damaged,
        panel_health=panel_health,
    )

