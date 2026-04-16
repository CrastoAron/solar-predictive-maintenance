from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from models.schemas import PredictionsResponse
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/predictions", response_model=PredictionsResponse | None)
async def get_predictions(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    return influx.get_latest_prediction(device_id)

