import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from simulate_sensor_ngrok import TELEMETRY_PATH, endpoint_url, make_payload


def test_ngrok_base_url_becomes_telemetry_endpoint():
    assert endpoint_url("https://example.ngrok-free.app") == f"https://example.ngrok-free.app{TELEMETRY_PATH}"


def test_simulated_payload_matches_telemetry_contract():
    payload = make_payload("esp32-test", [0, 1, 2, 3])

    assert {"device_id", "timestamp", "voltage", "current", "lux", "temperature", "humidity"} <= payload.keys()
    assert payload["hardware_status"] == {"bme280": 0, "ina219": 1, "bh1750": 2, "ds3231": 3}
