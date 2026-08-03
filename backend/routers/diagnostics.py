"""Authenticated, on-demand explainable diagnostics for the latest device state."""

from fastapi import APIRouter, Depends, HTTPException, Query

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from diagnostics import run_diagnostics
from models.schemas import DiagnosticsResponse
from services.expected_power_runner import get_expected_power_runner
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/diagnostics", response_model=DiagnosticsResponse | None)
async def get_diagnostics(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx_client = get_influx_client()
    telemetry = influx_client.get_latest_sensor(device_id)
    if telemetry is None:
        return None

    runner = get_expected_power_runner()
    if not runner.is_ready():
        raise HTTPException(status_code=503, detail="Expected-power baseline assets are not available")
    try:
        baseline = runner.predict(telemetry)
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"Invalid telemetry for diagnostics: {error}") from error

    history = influx_client.get_raw_data_last_minutes(device_id=device_id, minutes=30)
    historical_telemetry = history.to_dict(orient="records") if not history.empty else []
    hardware_status = influx_client.get_latest_hardware_status(device_id) or {}

    result = run_diagnostics(
        latest_telemetry=telemetry,
        historical_telemetry=historical_telemetry,
        hardware_status=hardware_status,
        baseline=baseline,
    )
    return result.to_dict()
