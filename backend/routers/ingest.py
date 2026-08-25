from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, Body, Header, HTTPException, Request, status

from config import ESP32_INGEST_TOKEN
from services.telemetry import ingest_sensor_payload


router = APIRouter(tags=["ESP32 telemetry"])


@router.post("/ingest/sensor", status_code=status.HTTP_202_ACCEPTED)
async def ingest_sensor(
    request: Request,
    payload: dict[str, Any] = Body(...),
    x_device_token: str | None = Header(default=None),
) -> dict[str, str]:
    """Accept the same telemetry JSON used on the MQTT topic over HTTPS."""
    if ESP32_INGEST_TOKEN and not secrets.compare_digest(
        x_device_token or "", ESP32_INGEST_TOKEN
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device token")

    try:
        ingest_sensor_payload(payload, request.app.state.influx_client)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"status": "accepted"}
