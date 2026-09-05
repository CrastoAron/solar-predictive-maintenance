from __future__ import annotations

from typing import Any

from supabase import create_client

from config import SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


class SupabaseClient:
    def __init__(self, url: str | None = None, key: str | None = None) -> None:
        self.url = url or SUPABASE_URL
        self.key = key or SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
        self._client = None

        if self.url and self.key:
            try:
                self._client = create_client(self.url, self.key)
            except Exception as err:
                print(f"[SupabaseClient] Failed to initialize client: {err}")
                self._client = None

    def get_client(self) -> Any:
        return self._client


supabase_client = SupabaseClient()


def verify_supabase_token(access_token: str) -> dict[str, str]:
    """Validate a Supabase access token and require an admin_users record."""
    client = supabase_client.get_client()
    if not client:
        raise RuntimeError("Supabase is not configured")

    try:
        response = client.auth.get_user(access_token)
        user = response.user
        if not user:
            raise ValueError("Supabase user was not found")

        admin_response = (
            client.table("admin_users")
            .select("role")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        admin_record = admin_response.data
        if not admin_record or admin_record.get("role") != "admin":
            return {"uid": user.id, "role": "customer"}

        return {"uid": user.id, "role": "admin", "email": user.email or ""}
    except Exception as err:
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Invalid or expired Supabase token") from err

