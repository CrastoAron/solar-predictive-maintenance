from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies import customer_device_id, get_current_user
from models.schemas import AlertsResponse
from services.admin_store import admin_store
from services.influx_client import get_influx_client

router = APIRouter()


@router.get("/api/alerts", response_model=AlertsResponse)
def get_alerts(
    device_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    is_admin = (user.get("role") or "").lower() == "admin"
    if is_admin:
        device_ids = [customer_device_id(user, device_id)]
        panels = [admin_store.get_panel_by_device_id(device_ids[0])]
    else:
        panels = admin_store.list_customer_panels(user.get("uid", ""))
        if device_id:
            device_ids = [customer_device_id(user, device_id)]
        else:
            device_ids = list({
                panel.get("esp32_id") for panel in panels if panel.get("esp32_id")
            })
        if not device_ids:
            return AlertsResponse(alerts=[])

    panels_by_device = {
        panel["esp32_id"]: panel
        for panel in panels
        if panel and panel.get("esp32_id")
    }
    alerts = []
    for resolved_device_id in device_ids:
        panel = panels_by_device.get(resolved_device_id)
        for alert in influx.get_latest_alerts(device_id=resolved_device_id, limit=50):
            alert["device_id"] = resolved_device_id
            alert["panel_id"] = panel.get("id") if panel else None
            alert["panel_name"] = (panel.get("name") or panel.get("id")) if panel else resolved_device_id
            if not alert.get("id"):
                alert["id"] = f"{resolved_device_id}-{alert.get('type', 'fault')}-{alert.get('severity', 'medium')}-{alert.get('timestamp', '')}"
            alerts.append(alert)

    alerts.sort(key=lambda alert: alert.get("timestamp", ""), reverse=True)

    return AlertsResponse(alerts=alerts)

