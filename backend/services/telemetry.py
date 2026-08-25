"""Transport-independent ESP32 telemetry ingestion."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from config import DEFAULT_DEVICE_ID
from services.influx_client import InfluxClient


def _parse_esp32_timestamp_to_utc_iso_z(value: str) -> str:
    """Normalize the timestamp formats emitted by the ESP32 to RFC3339 UTC."""
    if value is None:
        raise ValueError("timestamp is required")

    value = value.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        timestamp = datetime.fromisoformat(value)
    except ValueError:
        timestamp = datetime.strptime(value, "%Y-%m-%d %H:%M")

    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_hardware_status(payload: dict[str, Any]) -> dict[str, int] | None:
    status = payload.get("hardware_status")
    if status is None:
        return None
    if not isinstance(status, dict):
        raise ValueError("hardware_status must be an object")

    result: dict[str, int] = {}
    for key in ("bme280", "ina219", "bh1750", "ds3231"):
        if key not in status or status[key] is None:
            raise ValueError(f"hardware_status.{key} is required")
        value = status[key]
        if isinstance(value, bool):
            raise ValueError(f"hardware_status.{key} must be an integer")
        try:
            value_int = int(value)
        except Exception as exc:
            raise ValueError(f"hardware_status.{key} must be an integer") from exc
        if not 0 <= value_int <= 5:
            raise ValueError(f"hardware_status.{key} must be in 0..5")
        result[key] = value_int
    return result


def ingest_sensor_payload(payload: dict[str, Any], influx_client: InfluxClient) -> None:
    """Validate and store one reading, regardless of whether it arrived via MQTT or HTTPS.

    ``light`` is accepted as a compatibility alias for the existing firmware;
    newer clients may send the backend's canonical ``lux`` field.  A missing
    device ID uses the existing backend default for the same compatibility
    reason.
    """
    required = ("timestamp", "voltage", "current", "temperature", "humidity")
    missing = [key for key in required if payload.get(key) is None]
    if payload.get("lux") is None and payload.get("light") is None:
        missing.append("lux")
    if missing:
        raise ValueError(f"missing required field(s): {', '.join(missing)}")

    try:
        device_id = str(payload.get("device_id") or DEFAULT_DEVICE_ID)
        timestamp = _parse_esp32_timestamp_to_utc_iso_z(str(payload["timestamp"]))
        voltage = float(payload["voltage"])
        current = float(payload["current"])
        lux = float(payload.get("lux", payload.get("light")))
        temperature = float(payload["temperature"])
        humidity = float(payload["humidity"])
        hardware_status = _parse_hardware_status(payload)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"invalid sensor payload: {exc}") from exc

    influx_client.write_raw_sensor(
        device_id=device_id,
        timestamp=timestamp,
        voltage=voltage,
        current=current,
        power=voltage * current,
        lux=lux,
        temperature=temperature,
        humidity=humidity,
        bme280_status=hardware_status.get("bme280") if hardware_status else None,
        ina219_status=hardware_status.get("ina219") if hardware_status else None,
        bh1750_status=hardware_status.get("bh1750") if hardware_status else None,
        ds3231_status=hardware_status.get("ds3231") if hardware_status else None,
    )
