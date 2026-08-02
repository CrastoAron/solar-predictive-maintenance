"""Per-panel health evaluation using panel-specific rated configuration."""

from __future__ import annotations

from typing import Any, Mapping


def evaluate_panel_health(reading: Mapping[str, Any], panel_config: Mapping[str, Any] | None) -> str:
    """Return a health classification for a single panel based on its rating.

    The thresholds are normalized against the panel's own rated voltage/current
    rather than hard-coded global thresholds.
    """

    if not panel_config:
        return "normal"

    rated_voltage = panel_config.get("rated_voltage")
    rated_current = panel_config.get("rated_current")

    if rated_voltage in (None, 0) or rated_current in (None, 0):
        return "normal"

    voltage = float(reading.get("voltage", 0) or 0)
    current = float(reading.get("current", 0) or 0)

    v_ratio = voltage / float(rated_voltage)
    i_ratio = current / float(rated_current)

    if v_ratio < 0.6:
        return "critical_underperformance"
    if v_ratio < 0.85 or i_ratio < 0.85:
        return "degraded"
    if i_ratio > 1.1:
        return "overcurrent_risk"
    return "normal"
