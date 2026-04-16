from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID
from dependencies import get_current_user
from models.schemas import AlertsResponse
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/alerts", response_model=AlertsResponse)
async def get_alerts(
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    alerts = influx.get_latest_alerts(device_id=device_id, limit=50)

    # Ensure `id` is populated (Influx schema doesn't define a dedicated id field).
    for a in alerts:
        if not a.get("id"):
            a["id"] = f"{device_id}-{a.get('type','fault')}-{a.get('severity','medium')}-{a.get('timestamp','')}"

    return AlertsResponse(alerts=alerts)

