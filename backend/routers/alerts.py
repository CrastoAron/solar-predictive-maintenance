from fastapi import APIRouter, Depends, Query

from config import DEFAULT_DEVICE_ID
from dependencies import customer_device_id, get_current_user
from models.schemas import AlertsResponse
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/alerts", response_model=AlertsResponse)
async def get_alerts(
    device_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    resolved_device_id = customer_device_id(user, device_id)
    alerts = influx.get_latest_alerts(device_id=resolved_device_id, limit=50)

    # Ensure `id` is populated (Influx schema doesn't define a dedicated id field).
    for a in alerts:
        if not a.get("id"):
            a["id"] = f"{resolved_device_id}-{a.get('type','fault')}-{a.get('severity','medium')}-{a.get('timestamp','')}"

    return AlertsResponse(alerts=alerts)

