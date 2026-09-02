from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import paho.mqtt.client as mqtt

from config import (
    ESP32_NAIVE_TIMESTAMP_UTC_OFFSET_MINUTES,
    MQTT_HOST,
    MQTT_PORT,
    MQTT_QOS,
    MQTT_TOPIC,
)
from services.influx_client import InfluxClient


def _parse_esp32_timestamp_to_utc_iso_z(value: str) -> str:
    """
    Converts:
    - `YYYY-MM-DD HH:MM[:SS]` (no timezone) -> interpreted using the configured
      ESP32 RTC offset, output RFC3339 with `Z`
    - RFC3339/ISO-8601 -> normalized to `...Z`
    """
    if value is None:
        raise ValueError("timestamp is required")

    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        try:
            dt = datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            dt = datetime.strptime(v, "%Y-%m-%d %H:%M")

    if dt.tzinfo is None:
        device_timezone = timezone(
            timedelta(minutes=ESP32_NAIVE_TIMESTAMP_UTC_OFFSET_MINUTES)
        )
        dt = dt.replace(tzinfo=device_timezone)
    dt_utc = dt.astimezone(timezone.utc)
    return dt_utc.isoformat().replace("+00:00", "Z")


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
        except Exception:
            raise ValueError(f"hardware_status.{key} must be an integer")
        if value_int < 0 or value_int > 5:
            raise ValueError(f"hardware_status.{key} must be in 0..5")
        result[key] = value_int

    return result


def ingest_sensor_payload(influx_client: InfluxClient, payload: dict[str, Any]) -> None:
    """Validate and persist a telemetry payload from MQTT or HTTP(S)."""
    required = ["device_id", "timestamp", "voltage", "current", "lux", "temperature", "humidity"]
    for key in required:
        if key not in payload or payload[key] is None:
            raise ValueError(f"{key} is required")

    device_id = str(payload["device_id"])
    timestamp = _parse_esp32_timestamp_to_utc_iso_z(str(payload["timestamp"]))
    voltage = float(payload["voltage"])
    current = float(payload["current"])
    lux = float(payload["lux"])
    temperature = float(payload["temperature"])
    humidity = float(payload["humidity"])
    hardware_status = _parse_hardware_status(payload)

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


class MQTTSubscriber:
    def __init__(
        self,
        *,
        influx_client: InfluxClient,
        host: str = MQTT_HOST,
        port: int = MQTT_PORT,
        topic: str = MQTT_TOPIC,
        qos: int = MQTT_QOS,
    ) -> None:
        self._influx = influx_client
        self._host = host
        self._port = port
        self._topic = topic
        self._qos = qos

        self._client = mqtt.Client()
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._client.connect(self._host, self._port, keepalive=60)
        # paho manages its own thread; this does not block FastAPI's event loop.
        self._client.loop_start()
        self._started = True

    def stop(self) -> None:
        if not self._started:
            return
        try:
            self._client.loop_stop()
        finally:
            self._client.disconnect()
            self._started = False

    def _on_connect(self, client: mqtt.Client, userdata: Any, flags: dict[str, Any], rc: int) -> None:
        # Subscribe once connected.
        client.subscribe(self._topic, qos=self._qos)

    def _on_message(self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
        try:
            payload_str = msg.payload.decode("utf-8")
            payload = json.loads(payload_str)
        except Exception:
            return

        try:
            ingest_sensor_payload(self._influx, payload)
        except Exception:
            # Handle missing/null sensor values gracefully by skipping invalid points.
            return
