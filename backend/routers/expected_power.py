"""Authenticated API for live expected-power baseline inference."""

from fastapi import APIRouter, Depends, HTTPException, Query

from config import DEFAULT_DEVICE_ID
from dependencies import customer_device_id, get_current_user
from models.schemas import ExpectedPowerResponse
from services.expected_power_runner import get_expected_power_runner
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/expected-power", response_model=ExpectedPowerResponse | None)
async def get_expected_power(
    device_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    resolved_device_id = customer_device_id(user, device_id)
    telemetry = get_influx_client().get_latest_sensor(resolved_device_id)
    if telemetry is None:
        return None

    runner = get_expected_power_runner()
    if not runner.is_ready():
        raise HTTPException(status_code=503, detail="Expected-power baseline assets are not available")
    try:
        return runner.predict(telemetry)
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"Invalid telemetry for expected-power inference: {error}") from error
