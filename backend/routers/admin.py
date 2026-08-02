from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from dependencies import require_admin
from services.admin_store import admin_store

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/customers")
async def list_customers(_: dict = Depends(require_admin)) -> dict[str, Any]:
    return {"customers": admin_store.list_customers()}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, _: dict = Depends(require_admin)) -> dict[str, Any]:
    detail = admin_store.get_customer_detail(customer_id)
    if not detail:
        raise ValueError("Customer not found")
    return detail


@router.post("/customers/{customer_id}/arrays")
async def create_array(customer_id: str, _: dict = Depends(require_admin)) -> dict[str, Any]:
    array_ = admin_store.create_array(customer_id, rows=1, cols=1, name="Main Array")
    return {"customer_id": customer_id, "array": array_}


@router.post("/arrays/{array_id}/panels")
async def bulk_create_panels(array_id: str, _: dict = Depends(require_admin)) -> dict[str, Any]:
    panels = admin_store.bulk_create_panels(array_id=array_id, rows=1, cols=1)
    return {"array_id": array_id, "panels": panels}


@router.put("/panels/{panel_id}")
async def update_panel(panel_id: str, _: dict = Depends(require_admin)) -> dict[str, Any]:
    updated = admin_store.update_panel(panel_id, payload={})
    if not updated:
        raise ValueError("Panel not found")
    return {"panel_id": panel_id, "panel": updated}


@router.delete("/panels/{panel_id}")
async def delete_panel(panel_id: str, _: dict = Depends(require_admin)) -> dict[str, Any]:
    deleted = admin_store.delete_panel(panel_id)
    return {"panel_id": panel_id, "deleted": deleted}
