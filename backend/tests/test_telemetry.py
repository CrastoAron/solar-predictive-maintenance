import pytest

from services.mqtt_client import ingest_sensor_payload


class FakeInfluxClient:
    def __init__(self):
        self.writes = []

    def write_raw_sensor(self, **kwargs):
        self.writes.append(kwargs)


def test_http_and_mqtt_ingestion_share_the_same_telemetry_contract():
    influx = FakeInfluxClient()

    ingest_sensor_payload(
        influx,
        {
            "device_id": "esp32-01",
            "timestamp": "2026-08-30T12:00:00Z",
            "voltage": 18.2,
            "current": 1.4,
            "lux": 45000,
            "temperature": 31.5,
            "humidity": 55.0,
        },
    )

    assert len(influx.writes) == 1
    saved = influx.writes[0]
    assert saved["device_id"] == "esp32-01"
    assert saved["timestamp"] == "2026-08-30T12:00:00Z"
    assert saved["power"] == pytest.approx(25.48)
    assert saved["bme280_status"] is None
