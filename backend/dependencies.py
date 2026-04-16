from fastapi import Header, HTTPException

from services.firebase_admin import verify_firebase_token


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    return verify_firebase_token(token)

