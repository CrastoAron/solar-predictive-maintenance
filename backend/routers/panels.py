from __future__ import annotations

from fastapi import APIRouter, Depends

from dependencies import get_current_user
from services.admin_store import admin_store

router = APIRouter()


@router.get("/api/panels")
async def list_panels(user: dict = Depends(get_current_user)) -> list[dict]:
    return admin_store.list_customer_panels(user.get("uid", ""))


@router.get("/api/service-history")
async def list_service_history(user: dict = Depends(get_current_user)) -> list[dict]:
    return admin_store.list_customer_maintenance_tasks(user.get("uid", ""))