from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, HTTPException

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from models.schemas import HistoryPoint, HistoryResponse
from services.influx_client import get_influx_client

router = APIRouter()

ALLOWED_FIELDS = {"voltage", "current", "power", "temperature", "humidity", "lux"}


def _parse_query_dt(value: str) -> datetime:
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    dt = datetime.fromisoformat(v)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/api/history", response_model=HistoryResponse)
async def get_history(
    field: str = Query(...),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    if field not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid field")

    influx = get_influx_client()

    now_utc = datetime.now(timezone.utc)
    if not start or not end:
        # Requirement: default to last 24 hours if start/end not provided.
        end_dt = now_utc
        start_dt = now_utc - timedelta(hours=24)
    else:
        start_dt = _parse_query_dt(start)
        end_dt = _parse_query_dt(end)

    rows = influx.get_history_sensor_field(
        device_id=device_id,
        field=field,
        start=start_dt,
        end=end_dt,
    )

    data = [HistoryPoint(**row) for row in rows]
    return HistoryResponse(field=field, data=data)

