"""Small, deterministic diagnostic detectors. Add new detectors to DEFAULT_RULES."""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Protocol, Sequence

from diagnostics.constants import (
    DEGRADATION_RATIO,
    DUST_PERSISTENCE_RATIO,
    HARDWARE_STATUS_NAMES,
    LOOSE_WIRING_CURRENT_RATIO,
    LOOSE_WIRING_VOLTAGE_RATIO,
    LOW_EFFICIENCY_RATIO,
    LOW_POWER_WATTS,
    MIN_DAYLIGHT_LUX,
    MIN_HISTORY_SAMPLES,
    PARTIAL_SHADING_RATIO,
)
from diagnostics.models import CandidateCause, HardwareStatus, Telemetry


@dataclass(frozen=True)
class DiagnosticContext:
    latest: Telemetry
    history: Sequence[Telemetry]
    hardware_status: HardwareStatus

    @property
    def daylight_history(self) -> list[Telemetry]:
        return [row for row in self.history if row.lux >= MIN_DAYLIGHT_LUX]


class DiagnosticRule(Protocol):
    name: str

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None: ...


def _ratio(row: Telemetry) -> float:
    return row.power / max(row.lux / 1000.0, 0.001)


def _baseline(rows: Sequence[Telemetry], field: str) -> float | None:
    values = [getattr(row, field) for row in rows]
    return median(values) if values else None


class SensorFailureRule:
    name = "Sensor Failure"

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None:
        failed = [
            (name, value)
            for name, value in context.hardware_status.as_dict().items()
            if value != 0
        ]
        if not failed:
            return None
        evidence = tuple(
            f"{name} status is {code} ({HARDWARE_STATUS_NAMES.get(code, 'Unknown status')})."
            for name, code in failed
        )
        severity = "High" if any(code in {1, 2, 4} for _, code in failed) else "Medium"
        # A reported hardware fault takes precedence over inferred panel causes,
        # because those causes may be based on unreliable sensor readings.
        return CandidateCause(self.name, severity, evidence, 95.0 + min(len(failed) - 1, 2) * 2)


class PartialShadingRule:
    name = "Partial Shading"

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None:
        latest = context.latest
        baseline = _baseline(context.daylight_history, "power")
        if latest.lux < MIN_DAYLIGHT_LUX or baseline is None or baseline <= 0:
            return None
        # Compare output at comparable sunlight, not absolute nighttime power.
        baseline_ratio = _baseline(context.daylight_history, "power") / max(
            _baseline(context.daylight_history, "lux") / 1000.0, 0.001
        )
        current_ratio = _ratio(latest)
        if current_ratio >= baseline_ratio * PARTIAL_SHADING_RATIO:
            return None
        drop = 1.0 - current_ratio / baseline_ratio
        return CandidateCause(
            self.name,
            "Medium",
            (
                f"Light level is {latest.lux:.0f} lux, above the daylight threshold.",
                f"Current power-per-light ratio is {drop:.0%} below the historical daylight baseline.",
            ),
            74.0 + min(drop * 25.0, 16.0),
        )


class DustAccumulationRule:
    name = "Dust Accumulation"

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None:
        rows = context.daylight_history
        if len(rows) < MIN_HISTORY_SAMPLES or context.latest.lux < MIN_DAYLIGHT_LUX:
            return None
        ratios = [_ratio(row) for row in rows]
        recent = ratios[-MIN_HISTORY_SAMPLES:]
        older = ratios[:-MIN_HISTORY_SAMPLES]
        if not older:
            return None
        if median(recent) >= median(older) * DUST_PERSISTENCE_RATIO:
            return None
        decline = 1.0 - median(recent) / median(older)
        return CandidateCause(
            self.name,
            "Medium",
            (
                f"The last {len(recent)} daylight readings show persistently reduced power per lux.",
                f"Recent median efficiency ratio is {decline:.0%} below the earlier daylight baseline.",
            ),
            70.0 + min(decline * 25.0, 18.0),
        )


class PanelDegradationRule:
    name = "Panel Degradation"

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None:
        rows = context.daylight_history
        if len(rows) < MIN_HISTORY_SAMPLES * 2:
            return None
        midpoint = len(rows) // 2
        early = median(_ratio(row) for row in rows[:midpoint])
        late = median(_ratio(row) for row in rows[midpoint:])
        if late >= early * DEGRADATION_RATIO:
            return None
        decline = 1.0 - late / early
        return CandidateCause(
            self.name,
            "Medium",
            (
                f"Daylight power-per-light ratio declined by {decline:.0%} across the available history.",
                "The decline is sustained across both historical periods, rather than a single reading.",
            ),
            66.0 + min(decline * 30.0, 20.0),
        )


class PossiblePanelDamageRule:
    name = "Possible Panel Damage"

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None:
        latest = context.latest
        if latest.lux < MIN_DAYLIGHT_LUX or latest.power > LOW_POWER_WATTS:
            return None
        if any(value != 0 for value in context.hardware_status.as_dict().values()):
            return None
        return CandidateCause(
            self.name,
            "High",
            (
                f"Light level is {latest.lux:.0f} lux but measured panel power is only {latest.power:.2f} W.",
                "All reported hardware statuses are OK, reducing the likelihood of a sensor fault.",
            ),
            88.0,
        )


class LooseWiringRule:
    name = "Loose Wiring"

    def evaluate(self, context: DiagnosticContext) -> CandidateCause | None:
        latest = context.latest
        rows = context.daylight_history
        if latest.lux < MIN_DAYLIGHT_LUX or len(rows) < MIN_HISTORY_SAMPLES:
            return None
        voltage_baseline = _baseline(rows, "voltage")
        current_baseline = _baseline(rows, "current")
        if not voltage_baseline or not current_baseline:
            return None
        if latest.voltage >= voltage_baseline * LOOSE_WIRING_VOLTAGE_RATIO or latest.current >= current_baseline * LOOSE_WIRING_CURRENT_RATIO:
            return None
        return CandidateCause(
            self.name,
            "High",
            (
                f"Voltage is {latest.voltage:.2f} V versus a daylight baseline of {voltage_baseline:.2f} V.",
                f"Current is {latest.current:.2f} A versus a daylight baseline of {current_baseline:.2f} A.",
            ),
            82.0,
        )


DEFAULT_RULES: tuple[DiagnosticRule, ...] = (
    SensorFailureRule(),
    PossiblePanelDamageRule(),
    LooseWiringRule(),
    PartialShadingRule(),
    DustAccumulationRule(),
    PanelDegradationRule(),
)
