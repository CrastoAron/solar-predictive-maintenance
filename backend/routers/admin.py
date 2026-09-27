from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from pydantic import BaseModel, Field

from dependencies import require_supabase_admin
from diagnostics.panel_health import evaluate_panel_health
from services.admin_store import admin_store
from services.influx_client import get_influx_client

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateCustomerRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    firebase_uid: Optional[str] = None


class CreateArrayRequest(BaseModel):
    name: Optional[str] = "Main Array"


class CreatePanelRequest(BaseModel):
    name: Optional[str] = None
    esp32_id: Optional[str] = ""
    rated_voltage: Optional[float] = 38.5
    rated_current: Optional[float] = 9.8
    panel_width_mm: Optional[int] = 1650
    panel_height_mm: Optional[int] = 992


class UpdatePanelRequest(BaseModel):
    name: Optional[str] = None
    esp32_id: Optional[str] = None
    rated_voltage: Optional[float] = None
    rated_current: Optional[float] = None
    panel_width_mm: Optional[int] = None
    panel_height_mm: Optional[int] = None
    rated_power: Optional[float] = None


class EvaluatePanelHealthRequest(BaseModel):
    voltage: float
    current: float
    rated_voltage: float
    rated_current: float


class CreateMaintenanceTaskRequest(BaseModel):
    task_name: str = Field(..., min_length=1)
    task_type: str = Field(default="Inspection")
    status: str = Field(default="Scheduled")
    priority: str = Field(default="Medium")
    scheduled_date: Optional[str] = None
    panel_id: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    checklist: Optional[list[str]] = None


class UpdateMaintenanceTaskRequest(BaseModel):
    task_name: Optional[str] = None
    task_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    scheduled_date: Optional[str] = None
    completed_date: Optional[str] = None
    panel_id: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    checklist: Optional[list[str]] = None


@router.get("/customers")
async def list_customers(_: dict = Depends(require_supabase_admin)) -> dict[str, Any]:
    return {"customers": admin_store.sync_google_customers()}


@router.post("/customers")
async def create_customer(
    body: CreateCustomerRequest, _: dict = Depends(require_supabase_admin)
) -> dict[str, Any]:
    customer = admin_store.create_customer(
        name=body.name, email=body.email, firebase_uid=body.firebase_uid
    )
    return {"customer": customer}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, _: dict = Depends(require_supabase_admin)) -> dict[str, Any]:
    detail = admin_store.get_customer_detail(customer_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Customer not found")
    return detail


@router.get("/customers/{customer_id}/alerts")
async def list_customer_alerts(
    customer_id: str, _: dict = Depends(require_supabase_admin)
) -> dict[str, Any]:
    customer = admin_store.get_customer_detail(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    influx = get_influx_client()
    alerts = []
    for panel in customer.get("panels", []):
        device_id = panel.get("esp32_id")
        if not device_id:
            continue
        for alert in influx.get_latest_alerts(device_id=device_id, limit=50):
            alerts.append(
                {
                    **alert,
                    "id": alert.get("id") or f"{device_id}-{alert.get('type', 'fault')}-{alert.get('timestamp', '')}",
                    "panel_id": panel["id"],
                    "panel_name": panel.get("name") or panel["id"],
                    "esp32_id": device_id,
                }
            )

    alerts.sort(key=lambda alert: alert.get("timestamp", ""), reverse=True)
    return {"alerts": alerts}


@router.post("/customers/{customer_id}/panels")
async def add_panel_to_customer(
    customer_id: str, body: CreatePanelRequest, _: dict = Depends(require_supabase_admin)
) -> dict[str, Any]:
    payload = body.model_dump(exclude_unset=True)
    panel = admin_store.add_panel(customer_id, payload=payload)
    return {"customer_id": customer_id, "panel": panel}


@router.post("/customers/{customer_id}/arrays")
async def create_array(
    customer_id: str, body: CreateArrayRequest, _: dict = Depends(require_supabase_admin)
) -> dict[str, Any]:
    array_ = admin_store.create_array(customer_id=customer_id, name=body.name or "Main Array")
    return {"customer_id": customer_id, "array": array_}


@router.put("/panels/{panel_id}")
async def update_panel(
    panel_id: str,
    body: UpdatePanelRequest,
    customer_id: str = Query(...),
    _: dict = Depends(require_supabase_admin),
) -> dict[str, Any]:
    payload = body.model_dump(exclude_unset=True)
    updated = admin_store.update_panel(panel_id, customer_id=customer_id, payload=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Panel not found")
    return {"panel_id": panel_id, "panel": updated}


@router.delete("/panels/{panel_id}")
async def delete_panel(
    panel_id: str,
    customer_id: str = Query(...),
    _: dict = Depends(require_supabase_admin),
) -> dict[str, Any]:
    deleted = admin_store.delete_panel(panel_id, customer_id=customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Panel not found")
    return {"panel_id": panel_id, "deleted": deleted}


@router.post("/panels/evaluate")
async def evaluate_panel(
    body: EvaluatePanelHealthRequest, _: dict = Depends(require_supabase_admin)
) -> dict[str, Any]:
    reading = {"voltage": body.voltage, "current": body.current}
    panel_config = {"rated_voltage": body.rated_voltage, "rated_current": body.rated_current}

    health_status = evaluate_panel_health(reading, panel_config)

    v_ratio = body.voltage / body.rated_voltage if body.rated_voltage else 0
    i_ratio = body.current / body.rated_current if body.rated_current else 0

    return {
        "health_status": health_status,
        "v_ratio": round(v_ratio, 3),
        "i_ratio": round(i_ratio, 3),
        "voltage": body.voltage,
        "current": body.current,
        "rated_voltage": body.rated_voltage,
        "rated_current": body.rated_current,
    }


# ── Maintenance Tasks ──────────────────────────────────────────────


@router.get("/customers/{customer_id}/maintenance")
async def list_maintenance_tasks(
    customer_id: str,
    status: str | None = Query(default=None),
    task_type: str | None = Query(default=None),
    panel_id: str | None = Query(default=None),
    _: dict = Depends(require_supabase_admin),
) -> dict[str, Any]:
    tasks = admin_store.list_maintenance_tasks(
        customer_id, status=status, task_type=task_type, panel_id=panel_id
    )
    return {"tasks": tasks}


@router.post("/customers/{customer_id}/maintenance")
async def create_maintenance_task(
    customer_id: str,
    body: CreateMaintenanceTaskRequest,
    _: dict = Depends(require_supabase_admin),
) -> dict[str, Any]:
    payload = body.model_dump(exclude_unset=True)
    task = admin_store.create_maintenance_task(customer_id, payload=payload)
    if not task:
        raise HTTPException(status_code=404, detail="Panel does not belong to this customer")
    return {"customer_id": customer_id, "task": task}


@router.put("/maintenance/{task_id}")
async def update_maintenance_task(
    task_id: str,
    body: UpdateMaintenanceTaskRequest,
    customer_id: str = Query(...),
    _: dict = Depends(require_supabase_admin),
) -> dict[str, Any]:
    payload = body.model_dump(exclude_unset=True)
    updated = admin_store.update_maintenance_task(task_id, customer_id=customer_id, payload=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Maintenance task not found")
    return {"task_id": task_id, "task": updated}


@router.delete("/maintenance/{task_id}")
async def delete_maintenance_task(
    task_id: str, customer_id: str = Query(...), _: dict = Depends(require_supabase_admin)
) -> dict[str, Any]:
    deleted = admin_store.delete_maintenance_task(task_id, customer_id=customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Maintenance task not found")
    return {"task_id": task_id, "deleted": deleted}
