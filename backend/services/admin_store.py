from __future__ import annotations

from copy import deepcopy
from typing import Any


class AdminStore:
    def __init__(self) -> None:
        self._customers: list[dict[str, Any]] = []
        self._arrays: list[dict[str, Any]] = []
        self._panels: list[dict[str, Any]] = []

    def list_customers(self) -> list[dict[str, Any]]:
        return [deepcopy(customer) for customer in self._customers]

    def get_customer_detail(self, customer_id: str) -> dict[str, Any] | None:
        customer = next((item for item in self._customers if item["id"] == customer_id), None)
        if not customer:
            return None
        return {
            **deepcopy(customer),
            "arrays": [deepcopy(array_) for array_ in self._arrays if array_["customer_id"] == customer_id],
        }

    def create_array(self, customer_id: str, rows: int, cols: int, name: str) -> dict[str, Any]:
        array_id = f"array-{len(self._arrays) + 1}"
        array_ = {
            "id": array_id,
            "customer_id": customer_id,
            "name": name or "Main Array",
            "rows": rows,
            "cols": cols,
        }
        self._arrays.append(array_)
        return deepcopy(array_)

    def bulk_create_panels(self, array_id: str, rows: int, cols: int) -> list[dict[str, Any]]:
        panels: list[dict[str, Any]] = []
        for row_index in range(rows):
            for col_index in range(cols):
                panel_id = f"panel-{len(self._panels) + 1}"
                panel = {
                    "id": panel_id,
                    "array_id": array_id,
                    "row_index": row_index,
                    "col_index": col_index,
                    "esp32_id": "",
                    "panel_width_mm": None,
                    "panel_height_mm": None,
                    "rated_voltage": None,
                    "rated_current": None,
                    "rated_power": None,
                }
                self._panels.append(panel)
                panels.append(deepcopy(panel))
        return panels

    def update_panel(self, panel_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        for index, panel in enumerate(self._panels):
            if panel["id"] != panel_id:
                continue
            updated = deepcopy(panel)
            updated.update(payload)
            self._panels[index] = updated
            return deepcopy(updated)
        return None

    def delete_panel(self, panel_id: str) -> bool:
        before = len(self._panels)
        self._panels = [panel for panel in self._panels if panel["id"] != panel_id]
        return len(self._panels) != before


admin_store = AdminStore()

# Seed a sample customer so the admin dashboard has something to display immediately.
if not admin_store.list_customers():
    admin_store._customers.append({
        "id": "customer-1",
        "name": "Demo Customer",
        "email": "demo@example.com",
    })
