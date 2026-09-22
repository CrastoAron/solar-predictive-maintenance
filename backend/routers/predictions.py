from fastapi import APIRouter, Depends, Query

from dependencies import customer_device_id, get_current_user
from models.schemas import PredictionsResponse
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/predictions", response_model=PredictionsResponse | None)
async def get_predictions(
    device_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    return influx.get_latest_prediction(customer_device_id(user, device_id))

