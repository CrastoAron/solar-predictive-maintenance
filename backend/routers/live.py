from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from models.schemas import LiveResponse
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/live", response_model=LiveResponse | None)
async def get_live(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    return influx.get_latest_sensor(device_id)

