import routers.alerts as alerts_router


class FakeAdminStore:
    def list_customer_panels(self, firebase_uid):
        assert firebase_uid == "customer-1"
        return [
            {"id": "panel-1", "name": "Roof East", "esp32_id": "esp32-01"},
            {"id": "panel-2", "name": "Roof West", "esp32_id": "esp32-02"},
        ]


class FakeInfluxClient:
    def get_latest_alerts(self, device_id, limit):
        assert limit == 50
        return [
            {
                "id": "",
                "type": "low_output",
                "severity": "high",
                "message": f"Low output on {device_id}",
                "timestamp": f"2026-09-27T10:0{device_id[-1]}:00Z",
                "resolved": False,
            }
        ]


def test_customer_alerts_include_every_assigned_panel(monkeypatch):
    monkeypatch.setattr(alerts_router, "admin_store", FakeAdminStore())
    monkeypatch.setattr(alerts_router, "get_influx_client", FakeInfluxClient)

    response = alerts_router.get_alerts(
        device_id=None,
        user={"uid": "customer-1", "role": "customer"},
    )

    assert len(response.alerts) == 2
    assert {alert.panel_name for alert in response.alerts} == {"Roof East", "Roof West"}
    assert {alert.device_id for alert in response.alerts} == {"esp32-01", "esp32-02"}
