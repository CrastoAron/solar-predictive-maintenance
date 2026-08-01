from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from models.schemas import HardwareStatusResponse
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/hardware-status", response_model=HardwareStatusResponse | None)
async def get_hardware_status(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    return influx.get_latest_hardware_status(device_id)
