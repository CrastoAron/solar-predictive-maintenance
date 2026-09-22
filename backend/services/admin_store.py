from __future__ import annotations

from copy import deepcopy
import uuid
from typing import Any

from firebase_admin import auth as fb_auth
from services.firebase_admin import _ensure_firebase_initialized
from services.supabase_client import supabase_client


class AdminStore:
    def __init__(self) -> None:
        self._customers: list[dict[str, Any]] = []
        self._arrays: list[dict[str, Any]] = []
        self._panels: list[dict[str, Any]] = []
        self._maintenance_tasks: list[dict[str, Any]] = []
        self._seed_default_data()

    def _seed_default_data(self) -> None:
        pass

    def list_customers(self) -> list[dict[str, Any]]:
        client = supabase_client.get_client()
        if client:
            try:
                res = client.table("customers").select("*").order("created_at", desc=True).execute()
                return res.data or []
            except Exception as err:
                raise RuntimeError(f"Unable to list customers from Supabase: {err}") from err

        return [deepcopy(c) for c in self._customers]

    def sync_google_customers(self) -> list[dict[str, Any]]:
        """Mirror Firebase Google accounts into Supabase customer records."""
        _ensure_firebase_initialized()
        google_users: list[dict[str, Any]] = []
        for user in fb_auth.list_users().iterate_all():
            if not any(provider.provider_id == "google.com" for provider in user.provider_data):
                continue

            google_users.append(
                {
                    "firebase_uid": user.uid,
                    "name": user.display_name or user.email or "Google Customer",
                    "email": user.email or f"{user.uid}@invalid.local",
                }
            )

        client = supabase_client.get_client()
        if client:
            try:
                for customer in google_users:
                    client.table("customers").upsert(
                        {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, customer["firebase_uid"])), **customer},
                        on_conflict="firebase_uid",
                    ).execute()
            except Exception as err:
                raise RuntimeError(f"Unable to sync Firebase customers to Supabase: {err}") from err
        else:
            for customer in google_users:
                existing = next(
                    (item for item in self._customers if item.get("firebase_uid") == customer["firebase_uid"]),
                    None,
                )
                if existing:
                    existing.update(customer)
                else:
                    self._customers.append({"id": str(uuid.uuid4()), **customer})

        customers_by_uid = {customer["firebase_uid"]: customer for customer in google_users}
        return [
            {**customer, "provider": "Google"}
            for customer in self.list_customers()
            if customer.get("firebase_uid") in customers_by_uid
        ]

    def create_customer(self, name: str, email: str, firebase_uid: str | None = None) -> dict[str, Any]:
        client = supabase_client.get_client()
        new_id = str(uuid.uuid4())
        record = {
            "id": new_id,
            "name": name,
            "email": email,
            "firebase_uid": firebase_uid or f"uid-{new_id[:8]}",
        }

        if client:
            try:
                res = client.table("customers").insert(record).execute()
                if res and res.data:
                    return res.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to create customer in Supabase: {err}") from err

            raise RuntimeError("Supabase did not return the created customer")

        self._customers.append(record)
        return deepcopy(record)

    def get_customer_detail(self, customer_id: str) -> dict[str, Any] | None:
        client = supabase_client.get_client()
        if client:
            try:
                c_res = client.table("customers").select("*").eq("id", customer_id).execute()
                if c_res and c_res.data:
                    customer = c_res.data[0]
                    arr_res = client.table("panel_arrays").select("*").eq("customer_id", customer_id).execute()
                    arrays = arr_res.data if (arr_res and arr_res.data) else []

                    array_ids = [a["id"] for a in arrays]
                    panels = []
                    if array_ids:
                        p_res = client.table("panels").select("*").in_("array_id", array_ids).execute()
                        if p_res and p_res.data:
                            panels = p_res.data

                    for arr in arrays:
                        arr["panels"] = [p for p in panels if p["array_id"] == arr["id"]]

                    # Collect flat list of all panels for convenience
                    all_panels = [p for p in panels]

                    return {
                        **customer,
                        "arrays": arrays,
                        "panels": all_panels,
                    }
            except Exception as err:
                raise RuntimeError(f"Unable to load customer data from Supabase: {err}") from err

        # Fallback in-memory
        customer = next((item for item in self._customers if item["id"] == customer_id), None)
        if not customer:
            return None

        arrays = [deepcopy(a) for a in self._arrays if a["customer_id"] == customer_id]
        array_ids = [a["id"] for a in arrays]

        customer_panels = [deepcopy(p) for p in self._panels if p.get("array_id") in array_ids]

        for arr in arrays:
            arr["panels"] = [p for p in customer_panels if p.get("array_id") == arr["id"]]

        return {
            **deepcopy(customer),
            "arrays": arrays,
            "panels": customer_panels,
        }

    def add_panel(self, customer_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        client = supabase_client.get_client()

        # The panel editor adds one panel at a time.  Reuse the customer's first
        # array rather than consulting only the in-memory fallback; otherwise a
        # Supabase-backed customer received a new "Main Array" for every panel.
        arr = None
        if client:
            try:
                result = (
                    client.table("panel_arrays")
                    .select("*")
                    .eq("customer_id", customer_id)
                    .order("created_at")
                    .limit(1)
                    .execute()
                )
                if result and result.data:
                    arr = result.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to load panel arrays from Supabase: {err}") from err

        if not arr:
            arr = next((a for a in self._arrays if a["customer_id"] == customer_id), None)
        if not arr:
            arr = self.create_array(customer_id, rows=1, cols=1, name="Main Array")
        arr_id = arr["id"]

        panel_id = str(uuid.uuid4())
        v = payload.get("rated_voltage")
        i = payload.get("rated_current")
        p_watt = None
        if v is not None and i is not None:
            try:
                p_watt = round(float(v) * float(i), 1)
            except (ValueError, TypeError):
                pass

        new_panel = {
            "id": panel_id,
            "array_id": arr_id,
            "name": payload.get("name") or f"Solar Panel #{len([p for p in self._panels if p.get('array_id') == arr_id]) + 1}",
            "esp32_id": payload.get("esp32_id") or f"esp32-0{len(self._panels) + 1}",
            "cell_rows": max(1, int(payload.get("cell_rows") or 3)),
            "cell_cols": max(1, int(payload.get("cell_cols") or 4)),
            "row_index": 0,
            "col_index": len(self._panels),
            "panel_width_mm": payload.get("panel_width_mm") or 1650,
            "panel_height_mm": payload.get("panel_height_mm") or 992,
            "rated_voltage": v if v is not None else 38.5,
            "rated_current": i if i is not None else 9.8,
            "rated_power": p_watt or 377.3,
        }

        if client:
            try:
                res = client.table("panels").insert(new_panel).execute()
                if res and res.data:
                    return res.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to create panel in Supabase: {err}") from err

            raise RuntimeError("Supabase did not return the created panel")

        self._panels.append(new_panel)
        return deepcopy(new_panel)

    def create_array(self, customer_id: str, rows: int, cols: int, name: str = "Main Array") -> dict[str, Any]:
        client = supabase_client.get_client()
        new_id = str(uuid.uuid4())
        record = {
            "id": new_id,
            "customer_id": customer_id,
            "name": name or "Main Array",
            "rows": max(1, rows),
            "cols": max(1, cols),
        }

        if client:
            try:
                res = client.table("panel_arrays").insert(record).execute()
                if res and res.data:
                    return res.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to create panel array in Supabase: {err}") from err

            raise RuntimeError("Supabase did not return the created panel array")

        self._arrays.append(record)
        return deepcopy(record)

    def bulk_create_panels(self, array_id: str, rows: int, cols: int) -> list[dict[str, Any]]:
        """Create a grid of unassigned panels for an existing array."""
        panels = [
            {
                "id": str(uuid.uuid4()),
                "array_id": array_id,
                "name": f"Solar Panel {row_index + 1}-{col_index + 1}",
                "esp32_id": "",
                "cell_rows": 3,
                "cell_cols": 4,
                "row_index": row_index,
                "col_index": col_index,
                "panel_width_mm": None,
                "panel_height_mm": None,
                "rated_voltage": None,
                "rated_current": None,
                "rated_power": None,
            }
            for row_index in range(rows)
            for col_index in range(cols)
        ]

        client = supabase_client.get_client()
        if client:
            try:
                res = client.table("panels").insert(panels).execute()
                if res and res.data:
                    return res.data
            except Exception as err:
                raise RuntimeError(f"Unable to create panels in Supabase: {err}") from err

            raise RuntimeError("Supabase did not return the created panels")

        self._panels.extend(panels)
        return deepcopy(panels)

    def update_panel(self, panel_id: str, customer_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        client = supabase_client.get_client()

        v = payload.get("rated_voltage")
        i = payload.get("rated_current")
        if v is not None and i is not None and v != "" and i != "":
            try:
                payload["rated_power"] = round(float(v) * float(i), 1)
            except (ValueError, TypeError):
                pass

        if client:
            try:
                panel_res = client.table("panels").select("array_id").eq("id", panel_id).limit(1).execute()
                array_id = panel_res.data[0]["array_id"] if panel_res and panel_res.data else None
                if not array_id:
                    return None
                array_res = client.table("panel_arrays").select("id").eq("id", array_id).eq("customer_id", customer_id).limit(1).execute()
                if not array_res or not array_res.data:
                    return None
                res = client.table("panels").update(payload).eq("id", panel_id).execute()
                if res and res.data:
                    return res.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to update panel in Supabase: {err}") from err

            return None

        customer_array_ids = {a["id"] for a in self._arrays if a.get("customer_id") == customer_id}
        for index, panel in enumerate(self._panels):
            if panel["id"] == panel_id and panel.get("array_id") in customer_array_ids:
                updated = deepcopy(panel)
                updated.update(payload)
                self._panels[index] = updated
                return deepcopy(updated)
        return None

    def delete_panel(self, panel_id: str, customer_id: str) -> bool:
        client = supabase_client.get_client()
        if client:
            try:
                panel_res = client.table("panels").select("array_id").eq("id", panel_id).limit(1).execute()
                array_id = panel_res.data[0]["array_id"] if panel_res and panel_res.data else None
                if not array_id:
                    return False
                array_res = client.table("panel_arrays").select("id").eq("id", array_id).eq("customer_id", customer_id).limit(1).execute()
                if not array_res or not array_res.data:
                    return False
                res = client.table("panels").delete().eq("id", panel_id).execute()
                return bool(res and res.data)
            except Exception as err:
                raise RuntimeError(f"Unable to delete panel in Supabase: {err}") from err

        customer_array_ids = {a["id"] for a in self._arrays if a.get("customer_id") == customer_id}
        before = len(self._panels)
        self._panels = [p for p in self._panels if not (p["id"] == panel_id and p.get("array_id") in customer_array_ids)]
        return len(self._panels) != before

    def get_panel_by_device_id(self, device_id: str) -> dict[str, Any] | None:
        """Return the configured panel assigned to an ESP32 telemetry device."""
        client = supabase_client.get_client()
        if client:
            try:
                res = (
                    client.table("panels")
                    .select("*")
                    .eq("esp32_id", device_id)
                    .limit(1)
                    .execute()
                )
                return res.data[0] if res and res.data else None
            except Exception as err:
                raise RuntimeError(f"Unable to load panel configuration from Supabase: {err}") from err

        panel = next((item for item in self._panels if item.get("esp32_id") == device_id), None)
        return deepcopy(panel) if panel else None

    def list_customer_panels(self, firebase_uid: str) -> list[dict[str, Any]]:
        """Return panel configuration records belonging to a Firebase customer."""
        client = supabase_client.get_client()
        if client:
            try:
                customer = client.table("customers").select("id").eq("firebase_uid", firebase_uid).limit(1).execute()
                if not customer or not customer.data:
                    return []
                arrays = client.table("panel_arrays").select("id,name,rows,cols").eq("customer_id", customer.data[0]["id"]).execute()
                customer_arrays = arrays.data or []
                array_ids = [item["id"] for item in customer_arrays]
                if not array_ids:
                    return []
                panels = client.table("panels").select("*").in_("array_id", array_ids).execute()
                arrays_by_id = {array["id"]: array for array in customer_arrays}
                return [
                    {
                        **panel,
                        "setup": {
                            "id": panel["array_id"],
                            "name": arrays_by_id[panel["array_id"]].get("name"),
                            "rows": arrays_by_id[panel["array_id"]].get("rows"),
                            "cols": arrays_by_id[panel["array_id"]].get("cols"),
                        },
                    }
                    for panel in (panels.data or [])
                    if panel.get("array_id") in arrays_by_id
                ]
            except Exception as err:
                raise RuntimeError(f"Unable to load customer panels from Supabase: {err}") from err

        customer = next((item for item in self._customers if item.get("firebase_uid") == firebase_uid), None)
        if not customer:
            return []
        customer_arrays = {
            item["id"]: item for item in self._arrays if item.get("customer_id") == customer["id"]
        }
        return [
            {
                **deepcopy(panel),
                "setup": {
                    "id": panel["array_id"],
                    "name": customer_arrays[panel["array_id"]].get("name"),
                    "rows": customer_arrays[panel["array_id"]].get("rows"),
                    "cols": customer_arrays[panel["array_id"]].get("cols"),
                },
            }
            for panel in self._panels
            if panel.get("array_id") in customer_arrays
        ]

    def list_customer_device_ids(self, firebase_uid: str) -> list[str]:
        """Return telemetry device IDs assigned to a Firebase customer."""
        return [
            panel["esp32_id"]
            for panel in self.list_customer_panels(firebase_uid)
            if panel.get("esp32_id")
        ]

    def list_customer_maintenance_tasks(self, firebase_uid: str) -> list[dict[str, Any]]:
        """Return maintenance tasks belonging to a Firebase customer."""
        client = supabase_client.get_client()
        if client:
            try:
                customer = client.table("customers").select("id").eq("firebase_uid", firebase_uid).limit(1).execute()
                if not customer or not customer.data:
                    return []
                return self.list_maintenance_tasks(customer.data[0]["id"])
            except Exception as err:
                raise RuntimeError(f"Unable to load customer maintenance tasks from Supabase: {err}") from err

        customer = next((item for item in self._customers if item.get("firebase_uid") == firebase_uid), None)
        if not customer:
            return []
        return self.list_maintenance_tasks(customer["id"])

    # ── Maintenance Tasks ──────────────────────────────────────────────

    def list_maintenance_tasks(
        self, customer_id: str, *, status: str | None = None, task_type: str | None = None, panel_id: str | None = None
    ) -> list[dict[str, Any]]:
        client = supabase_client.get_client()
        if client:
            try:
                q = client.table("maintenance_tasks").select("*").eq("customer_id", customer_id)
                if status:
                    q = q.eq("status", status)
                if task_type:
                    q = q.eq("task_type", task_type)
                if panel_id:
                    q = q.eq("panel_id", panel_id)
                res = q.order("scheduled_date", desc=True).execute()
                return res.data or []
            except Exception as err:
                raise RuntimeError(f"Unable to list maintenance tasks from Supabase: {err}") from err

        tasks = [deepcopy(t) for t in self._maintenance_tasks if t["customer_id"] == customer_id]
        if status:
            tasks = [t for t in tasks if t.get("status") == status]
        if task_type:
            tasks = [t for t in tasks if t.get("task_type") == task_type]
        if panel_id:
            tasks = [t for t in tasks if t.get("panel_id") == panel_id]
        return tasks

    def create_maintenance_task(self, customer_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        client = supabase_client.get_client()
        task_id = str(uuid.uuid4())
        panel_id = payload.get("panel_id")
        if panel_id and client:
            panel_res = client.table("panels").select("array_id").eq("id", panel_id).limit(1).execute()
            array_id = panel_res.data[0]["array_id"] if panel_res and panel_res.data else None
            if not array_id:
                return None
            array_res = client.table("panel_arrays").select("id").eq("id", array_id).eq("customer_id", customer_id).limit(1).execute()
            if not array_res or not array_res.data:
                return None
        elif panel_id:
            customer_array_ids = {a["id"] for a in self._arrays if a.get("customer_id") == customer_id}
            if not any(p.get("id") == panel_id and p.get("array_id") in customer_array_ids for p in self._panels):
                return None
        record = {
            "id": task_id,
            "customer_id": customer_id,
            "panel_id": panel_id,
            "task_name": payload.get("task_name", "Untitled Task"),
            "task_type": payload.get("task_type", "Inspection"),
            "status": payload.get("status", "Scheduled"),
            "priority": payload.get("priority", "Medium"),
            "scheduled_date": payload.get("scheduled_date"),
            "assigned_to": payload.get("assigned_to"),
            "description": payload.get("description"),
            "estimated_duration_minutes": payload.get("estimated_duration_minutes"),
            "checklist": payload.get("checklist", []),
        }

        if client:
            try:
                res = client.table("maintenance_tasks").insert(record).execute()
                if res and res.data:
                    return res.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to create maintenance task in Supabase: {err}") from err
            raise RuntimeError("Supabase did not return the created maintenance task")

        self._maintenance_tasks.append(record)
        return deepcopy(record)

    def update_maintenance_task(self, task_id: str, customer_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        client = supabase_client.get_client()
        panel_id = payload.get("panel_id")
        if panel_id:
            if client:
                panel_res = client.table("panels").select("array_id").eq("id", panel_id).limit(1).execute()
                array_id = panel_res.data[0]["array_id"] if panel_res and panel_res.data else None
                if not array_id:
                    return None
                array_res = client.table("panel_arrays").select("id").eq("id", array_id).eq("customer_id", customer_id).limit(1).execute()
                if not array_res or not array_res.data:
                    return None
            else:
                customer_array_ids = {a["id"] for a in self._arrays if a.get("customer_id") == customer_id}
                if not any(p.get("id") == panel_id and p.get("array_id") in customer_array_ids for p in self._panels):
                    return None
        if client:
            try:
                res = client.table("maintenance_tasks").update(payload).eq("id", task_id).eq("customer_id", customer_id).execute()
                if res and res.data:
                    return res.data[0]
            except Exception as err:
                raise RuntimeError(f"Unable to update maintenance task in Supabase: {err}") from err
            return None

        for index, task in enumerate(self._maintenance_tasks):
            if task["id"] == task_id and task.get("customer_id") == customer_id:
                updated = deepcopy(task)
                updated.update(payload)
                self._maintenance_tasks[index] = updated
                return deepcopy(updated)
        return None

    def delete_maintenance_task(self, task_id: str, customer_id: str) -> bool:
        client = supabase_client.get_client()
        if client:
            try:
                res = client.table("maintenance_tasks").delete().eq("id", task_id).eq("customer_id", customer_id).execute()
                return bool(res and res.data)
            except Exception as err:
                raise RuntimeError(f"Unable to delete maintenance task in Supabase: {err}") from err

        before = len(self._maintenance_tasks)
        self._maintenance_tasks = [t for t in self._maintenance_tasks if not (t["id"] == task_id and t.get("customer_id") == customer_id)]
        return len(self._maintenance_tasks) != before


admin_store = AdminStore()
