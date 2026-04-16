from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from config import (
    INFLUX_BUCKET_ALERTS,
    INFLUX_BUCKET_PREDICTIONS,
    INFLUX_BUCKET_RAW,
    INFLUX_LATEST_LOOKBACK,
    INFLUX_ORG,
    INFLUX_TOKEN,
    INFLUX_URL,
)


def _ensure_required_config() -> None:
    if not INFLUX_URL or not INFLUX_TOKEN or not INFLUX_ORG:
        # Keep error readable in logs; FastAPI will surface 500 at runtime.
        raise RuntimeError(
            "Missing InfluxDB config. Set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG (and buckets)."
        )


def _parse_utc_timestamp(value: str) -> datetime:
    """
    Parses the ESP32/backend timestamps into UTC datetimes.

    Supported inputs:
    - `YYYY-MM-DD HH:MM` (no timezone) -> treated as UTC
    - RFC3339 / ISO-8601, including `...Z` and `...+00:00`
    """
    if value is None:
        raise ValueError("Timestamp is required")

    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        # Expected by ESP32 contract: "YYYY-MM-DD HH:MM"
        dt = datetime.strptime(v, "%Y-%m-%d %H:%M")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _utc_iso_z(dt: datetime) -> str:
    dt_utc = dt.astimezone(timezone.utc)
    return dt_utc.isoformat().replace("+00:00", "Z")


def _row_get(row_values: dict[str, Any], key: str) -> Any:
    # Influx records/pivot can return values under different keys; normalize.
    v = row_values.get(key)
    return v


class InfluxClient:
    def __init__(self) -> None:
        _ensure_required_config()
        self._client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
        self._query_api = self._client.query_api()

    def close(self) -> None:
        self._client.close()

    def write_raw_sensor(
        self,
        *,
        device_id: str,
        timestamp: str,
        voltage: float,
        current: float,
        power: float,
        lux: float,
        temperature: float,
        humidity: float,
    ) -> None:
        # The requirement says: on receive validate + skip invalid/null points.
        # So we enforce non-null numeric values here too.
        for name, val in [
            ("voltage", voltage),
            ("current", current),
            ("power", power),
            ("lux", lux),
            ("temperature", temperature),
            ("humidity", humidity),
        ]:
            if val is None:
                return

        dt = _parse_utc_timestamp(timestamp)

        point = (
            Point("sensor_data")
            .tag("device_id", device_id)
            .field("voltage", float(voltage))
            .field("current", float(current))
            .field("power", float(power))
            .field("lux", float(lux))
            .field("temperature", float(temperature))
            .field("humidity", float(humidity))
            .time(dt, WritePrecision.NS)
        )

        self._write_api.write(bucket=INFLUX_BUCKET_RAW, record=point)

    def write_prediction(
        self,
        *,
        device_id: str,
        predicted_at: datetime,
        fault_class: int,
        fault_label: str,
        efficiency_score: float,
        maintenance_days: int,
    ) -> None:
        point = (
            Point("ml_output")
            .tag("device_id", device_id)
            .field("fault_class", int(fault_class))
            .field("fault_label", str(fault_label))
            .field("efficiency_score", float(efficiency_score))
            .field("maintenance_days", int(maintenance_days))
            .time(predicted_at.astimezone(timezone.utc), WritePrecision.NS)
        )
        self._write_api.write(bucket=INFLUX_BUCKET_PREDICTIONS, record=point)

    def write_alert(
        self,
        *,
        device_id: str,
        alert_type: str,
        severity: str,
        message: str,
        resolved: bool = False,
        timestamp: datetime | None = None,
    ) -> None:
        event_time = (timestamp or datetime.now(timezone.utc)).astimezone(timezone.utc)
        point = (
            Point("alert_event")
            .tag("device_id", device_id)
            .tag("type", alert_type)
            .tag("severity", severity)
            .field("message", str(message))
            .field("resolved", bool(resolved))
            .time(event_time, WritePrecision.NS)
        )
        self._write_api.write(bucket=INFLUX_BUCKET_ALERTS, record=point)

    def _query_single_row(self, query: str) -> dict[str, Any] | None:
        tables = self._query_api.query(query, org=INFLUX_ORG)
        for table in tables:
            for record in table.records:
                # record.values includes _time + pivoted fields.
                return record.values
        return None

    def _query_rows(self, query: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        tables = self._query_api.query(query, org=INFLUX_ORG)
        for table in tables:
            for record in table.records:
                rows.append(record.values)
        return rows

    def get_latest_sensor(self, device_id: str) -> dict[str, Any] | None:
        # Latest = row with maximum _time for that device_id (per requirement).
        query = f"""
from(bucket: "{INFLUX_BUCKET_RAW}")
  |> range(start: -{INFLUX_LATEST_LOOKBACK})
  |> filter(fn: (r) => r._measurement == "sensor_data" and r.device_id == "{device_id}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> keep(columns: ["_time","voltage","current","power","lux","temperature","humidity"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
"""
        row = self._query_single_row(query)
        if not row:
            return None

        required_keys = ["voltage", "current", "power", "lux", "temperature", "humidity"]
        if any(_row_get(row, k) is None for k in required_keys):
            return None

        dt = row.get("_time")
        if isinstance(dt, datetime):
            timestamp = _utc_iso_z(dt)
        else:
            timestamp = _utc_iso_z(_parse_utc_timestamp(str(dt)))

        return {
            "device_id": device_id,
            "timestamp": timestamp,
            "voltage": float(row["voltage"]),
            "current": float(row["current"]),
            "power": float(row["power"]),
            "lux": float(row["lux"]),
            "temperature": float(row["temperature"]),
            "humidity": float(row["humidity"]),
        }

    def get_raw_data_last_minutes(
        self,
        *,
        device_id: str,
        minutes: int = 30,
    ) -> pd.DataFrame:
        query = f"""
from(bucket: "{INFLUX_BUCKET_RAW}")
  |> range(start: -{minutes}m)
  |> filter(fn: (r) => r._measurement == "sensor_data" and r.device_id == "{device_id}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> keep(columns: ["_time","voltage","current","power","lux","temperature","humidity"])
  |> sort(columns: ["_time"], desc: false)
"""
        rows = self._query_rows(query)
        data: list[dict[str, Any]] = []
        required = ["voltage", "current", "power", "lux", "temperature", "humidity"]
        for row in rows:
            dt = row.get("_time")
            if dt is None or any(row.get(k) is None for k in required):
                continue
            if not isinstance(dt, datetime):
                dt = _parse_utc_timestamp(str(dt))
            data.append(
                {
                    "timestamp": dt.astimezone(timezone.utc),
                    "voltage": float(row["voltage"]),
                    "current": float(row["current"]),
                    "power": float(row["power"]),
                    "lux": float(row["lux"]),
                    "temperature": float(row["temperature"]),
                    "humidity": float(row["humidity"]),
                }
            )
        return pd.DataFrame(data)

    def get_history_sensor_field(
        self,
        *,
        device_id: str,
        field: str,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        start_iso = _utc_iso_z(start)
        end_iso = _utc_iso_z(end)

        query = f"""
from(bucket: "{INFLUX_BUCKET_RAW}")
  |> range(start: {start_iso}, stop: {end_iso})
  |> filter(fn: (r) => r._measurement == "sensor_data" and r.device_id == "{device_id}" and r._field == "{field}")
  |> filter(fn: (r) => exists r._value)
  |> filter(fn: (r) => r._value != null)
  |> keep(columns: ["_time","_value"])
  |> sort(columns: ["_time"], desc: false)
"""
        rows = self._query_rows(query)
        out: list[dict[str, Any]] = []
        for row in rows:
            dt = row.get("_time")
            val = row.get("_value")
            if dt is None or val is None:
                continue
            if isinstance(dt, datetime):
                ts = _utc_iso_z(dt)
            else:
                ts = _utc_iso_z(_parse_utc_timestamp(str(dt)))
            out.append({"timestamp": ts, "value": float(val)})
        return out

    def get_latest_prediction(self, device_id: str) -> dict[str, Any] | None:
        query = f"""
from(bucket: "{INFLUX_BUCKET_PREDICTIONS}")
  |> range(start: -{INFLUX_LATEST_LOOKBACK})
  |> filter(fn: (r) => r._measurement == "ml_output" and r.device_id == "{device_id}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> keep(columns: ["_time","fault_class","fault_label","efficiency_score","maintenance_days"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
"""
        row = self._query_single_row(query)
        if not row:
            return None

        required_keys = ["fault_class", "fault_label", "efficiency_score", "maintenance_days"]
        if any(_row_get(row, k) is None for k in required_keys):
            return None

        dt = row.get("_time")
        if isinstance(dt, datetime):
            timestamp = _utc_iso_z(dt)
        else:
            timestamp = _utc_iso_z(_parse_utc_timestamp(str(dt)))

        return {
            "fault_class": int(row["fault_class"]),
            "fault_label": str(row["fault_label"]),
            "efficiency_score": float(row["efficiency_score"]),
            "maintenance_days": int(row["maintenance_days"]),
            "predicted_at": timestamp,
        }

    def get_latest_alerts(self, device_id: str, limit: int = 50) -> list[dict[str, Any]]:
        query = f"""
from(bucket: "{INFLUX_BUCKET_ALERTS}")
  |> range(start: -{INFLUX_LATEST_LOOKBACK})
  |> filter(fn: (r) => r._measurement == "alert_event" and r.device_id == "{device_id}")
  |> filter(fn: (r) => r._field == "message" or r._field == "resolved")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> keep(columns: ["_time","type","severity","message","resolved"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: {limit})
"""
        rows = self._query_rows(query)

        out: list[dict[str, Any]] = []
        for row in rows:
            dt = row.get("_time")
            if dt is None:
                continue
            if not isinstance(dt, datetime):
                dt = _parse_utc_timestamp(str(dt))

            message = row.get("message")
            resolved = row.get("resolved")
            type_ = row.get("type")
            severity = row.get("severity")

            # Message/resolved are the minimal required fields.
            if message is None or resolved is None:
                continue

            resolved_bool = bool(resolved)

            out.append(
                {
                    "id": "",
                    "type": str(type_) if type_ is not None else "fault",
                    "severity": str(severity) if severity is not None else "medium",
                    "message": str(message),
                    "timestamp": _utc_iso_z(dt),
                    "resolved": resolved_bool,
                }
            )
        return out

    def get_efficiency_scores_last(
        self,
        device_id: str,
        *,
        limit: int = 6,
        lookback: str | None = None,
    ) -> list[dict[str, Any]]:
        # Fetch N efficiency_score values and return them in chronological order.
        # (sort desc/limit then sort asc for stable trend.)
        lookback_val = lookback or INFLUX_LATEST_LOOKBACK
        query = f"""
from(bucket: "{INFLUX_BUCKET_PREDICTIONS}")
  |> range(start: -{lookback_val})
  |> filter(fn: (r) => r._measurement == "ml_output" and r.device_id == "{device_id}" and r._field == "efficiency_score")
  |> filter(fn: (r) => exists r._value and r._value != null)
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: {limit})
  |> sort(columns: ["_time"], desc: false)
  |> keep(columns: ["_time","_value"])
"""
        rows = self._query_rows(query)
        out: list[dict[str, Any]] = []
        for row in rows:
            dt = row.get("_time")
            val = row.get("_value")
            if dt is None or val is None:
                continue
            if not isinstance(dt, datetime):
                dt = _parse_utc_timestamp(str(dt))
            out.append({"timestamp": _utc_iso_z(dt), "value": float(val)})
        return out


_influx_client: InfluxClient | None = None


def get_influx_client() -> InfluxClient:
    global _influx_client
    if _influx_client is None:
        _influx_client = InfluxClient()
    return _influx_client

