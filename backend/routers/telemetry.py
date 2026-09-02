from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from services.mqtt_client import ingest_sensor_payload


router = APIRouter(tags=["telemetry"])


class HardwareStatusInput(BaseModel):
    bme280: int
    ina219: int
    bh1750: int
    ds3231: int


class TelemetryInput(BaseModel):
    device_id: str
    timestamp: str
    voltage: float
    current: float
    lux: float
    temperature: float
    humidity: float
    hardware_status: HardwareStatusInput | None = None


@router.post("/api/telemetry", status_code=status.HTTP_202_ACCEPTED)
async def ingest_telemetry(payload: TelemetryInput, request: Request) -> dict[str, str]:
    """Accept ESP32 JSON telemetry over HTTP(S), using the MQTT data contract."""
    try:
        ingest_sensor_payload(
            request.app.state.influx_client,
            payload.model_dump(exclude_none=True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"status": "accepted"}
