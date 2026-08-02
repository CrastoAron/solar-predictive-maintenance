from __future__ import annotations

from typing import Any

from supabase import create_client

from config import SUPABASE_ANON_KEY, SUPABASE_URL


class SupabaseClient:
    def __init__(self, url: str | None = None, key: str | None = None) -> None:
        self.url = url or SUPABASE_URL
        self.key = key or SUPABASE_ANON_KEY
        self._client = None

        if self.url and self.key:
            self._client = create_client(self.url, self.key)

    def get_client(self) -> Any:
        return self._client


supabase_client = SupabaseClient()
