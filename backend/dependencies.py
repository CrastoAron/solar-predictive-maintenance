from fastapi import Depends, Header, HTTPException

from services.admin_store import admin_store
from services.firebase_admin import verify_firebase_token
from services.supabase_client import verify_supabase_token


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        return verify_firebase_token(token)
    except Exception:
        try:
            return verify_supabase_token(token)
        except Exception as error:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from error


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    raise HTTPException(status_code=410, detail="Firebase admin authentication has been replaced")


async def require_supabase_admin(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    user = verify_supabase_token(token)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def customer_device_id(user: dict, requested_device_id: str | None = None) -> str:
    """Resolve a device owned by the authenticated customer."""
    if (user.get("role") or "").lower() == "admin":
        return requested_device_id or "esp32-01"

    device_ids = admin_store.list_customer_device_ids(user.get("uid", ""))
    if requested_device_id:
        if requested_device_id not in device_ids:
            raise HTTPException(status_code=403, detail="Device is not assigned to this customer")
        return requested_device_id
    if not device_ids:
        raise HTTPException(status_code=404, detail="No solar panels are assigned to this customer")
    return device_ids[0]
