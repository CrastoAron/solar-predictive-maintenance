from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID, EFFICIENCY_ALERT_MAX_SCORE, FAULT_ALERT_MIN_CLASS
from dependencies import get_current_user
from models.schemas import MaintenanceResponse
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

    now_utc = datetime.now(timezone.utc)

    days_remaining = int(latest["maintenance_days"])
    next_service_date = (now_utc + timedelta(days=days_remaining)).date().isoformat()

    scores = influx.get_efficiency_scores_last(device_id=device_id, limit=6)
    trend = _trend_label([row["value"] for row in scores])

    fault_class = int(latest["fault_class"])
    efficiency_score = float(latest["efficiency_score"])

    if fault_class >= FAULT_ALERT_MIN_CLASS or efficiency_score < EFFICIENCY_ALERT_MAX_SCORE:
        recommendation = "Clean panel surface and check INA219 wiring"
    else:
        recommendation = "System operating normally. Continue monitoring solar panel performance."

    return MaintenanceResponse(
        days_remaining=days_remaining,
        next_service_date=next_service_date,
        efficiency_trend=trend,
        recommendation=recommendation,
    )

