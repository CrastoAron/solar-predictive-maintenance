"""Runtime inference for the separately trained expected-power baseline."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from config import (
    EXPECTED_POWER_DAYLIGHT_LUX_MIN,
    EXPECTED_POWER_FEATURES_PATH,
    EXPECTED_POWER_MODEL_PATH,
)

EXPECTED_POWER_FLOOR_W = 0.10


class ExpectedPowerRunner:
    """Predict expected daylight output without using legacy fault-model assets."""

    def __init__(
        self,
        *,
        model_path: Path = EXPECTED_POWER_MODEL_PATH,
        features_path: Path = EXPECTED_POWER_FEATURES_PATH,
        daylight_lux_min: float = EXPECTED_POWER_DAYLIGHT_LUX_MIN,
    ) -> None:
        self._model_path = model_path
        self._features_path = features_path
        self._daylight_lux_min = daylight_lux_min
        self._model: Any | None = None
        self._feature_order: list[str] = []
        self._load_assets()

    def _load_assets(self) -> None:
        if self._features_path.exists():
            with open(self._features_path, "r", encoding="utf-8") as file:
                self._feature_order = json.load(file)["feature_order"]
        if self._model_path.exists():
            self._model = joblib.load(self._model_path)

    def is_ready(self) -> bool:
        return self._model is not None and bool(self._feature_order)

    def predict(self, telemetry: dict[str, Any]) -> dict[str, Any]:
        """Return expected power and an operational status for one live sample."""
        if not self.is_ready():
            raise RuntimeError(
                "Expected-power assets are not ready. Ensure the baseline model and feature-order JSON exist."
            )

        timestamp = _parse_timestamp(str(telemetry["timestamp"]))
        lux = float(telemetry["lux"])
        actual_power = float(telemetry.get("power", float(telemetry["voltage"]) * float(telemetry["current"])))

        base = {
            "device_id": str(telemetry["device_id"]),
            "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
            "actual_power": actual_power,
        }

        # The model was intentionally trained only for daylight samples. Avoid
        # extrapolating a daytime baseline into normal nighttime operation.
        if lux < self._daylight_lux_min:
            return {
                **base,
                "expected_power": None,
                "performance_ratio": None,
                "operational_status": "Not evaluated (low light)",
            }

        feature_values = _build_features(
            timestamp=timestamp,
            lux=lux,
            temperature=float(telemetry["temperature"]),
            humidity=float(telemetry["humidity"]),
        )
        row = pd.DataFrame(
            [{name: feature_values[name] for name in self._feature_order}],
            columns=self._feature_order,
        )
        expected_power = max(float(self._model.predict(row)[0]), EXPECTED_POWER_FLOOR_W)
        ratio = actual_power / expected_power

        if ratio >= 0.80:
            status = "Normal"
        elif ratio >= 0.50:
            status = "Underperforming"
        else:
            status = "Strong anomaly"

        return {
            **base,
            "expected_power": expected_power,
            "performance_ratio": ratio,
            "operational_status": status,
        }


def _parse_timestamp(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    try:
        timestamp = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise ValueError("Telemetry timestamp must be ISO-8601/RFC3339.") from error
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def _build_features(
    *,
    timestamp: datetime,
    lux: float,
    temperature: float,
    humidity: float,
) -> dict[str, float]:
    hour = timestamp.hour + timestamp.minute / 60.0 + timestamp.second / 3600.0
    angle = 2.0 * np.pi * hour / 24.0
    return {
        "lux": lux,
        "temperature": temperature,
        "humidity": humidity,
        "hour_sin": float(np.sin(angle)),
        "hour_cos": float(np.cos(angle)),
    }


_expected_power_runner: ExpectedPowerRunner | None = None


def get_expected_power_runner() -> ExpectedPowerRunner:
    global _expected_power_runner
    if _expected_power_runner is None:
        _expected_power_runner = ExpectedPowerRunner()
    return _expected_power_runner
