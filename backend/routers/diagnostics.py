from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from diagnostics import run_diagnostics
from models.schemas import DiagnosticsResponse
from services.admin_store import admin_store
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/diagnostics", response_model=DiagnosticsResponse | None)
async def get_diagnostics(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    latest_sensor = influx.get_latest_sensor(device_id)
    if latest_sensor is None:
        return None

    recent_sensor_history_df = influx.get_raw_data_last_minutes(device_id=device_id, minutes=30)
    recent_sensor_history = [
        {
            "timestamp": row["timestamp"].isoformat().replace("+00:00", "Z"),
            "voltage": row["voltage"],
            "current": row["current"],
            "power": row["power"],
            "lux": row["lux"],
            "temperature": row["temperature"],
            "humidity": row["humidity"],
        }
        for _, row in recent_sensor_history_df.iterrows()
    ]

    latest_prediction = influx.get_latest_prediction(device_id)
    latest_hardware_status = influx.get_latest_hardware_status(device_id)
    panel_config = admin_store.get_panel_by_device_id(device_id)

    result = run_diagnostics(
        latest_telemetry=latest_sensor,
        historical_telemetry=recent_sensor_history,
        ml_prediction=latest_prediction,
        hardware_status=latest_hardware_status,
        panel_config=panel_config,
    )
    return result.to_dict()
