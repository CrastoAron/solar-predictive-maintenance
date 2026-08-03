"""Typed, transport-neutral models for the diagnostics package."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Mapping, Sequence


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _integer(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class HardwareStatus:
    bme280: int = 0
    ina219: int = 0
    bh1750: int = 0
    ds3231: int = 0

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "HardwareStatus":
        value = value or {}
        return cls(
            bme280=_integer(value.get("bme280")),
            ina219=_integer(value.get("ina219")),
            bh1750=_integer(value.get("bh1750")),
            ds3231=_integer(value.get("ds3231")),
        )

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class Telemetry:
    voltage: float
    current: float
    power: float
    lux: float
    temperature: float
    humidity: float
    timestamp: str | None = None
    device_id: str | None = None

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "Telemetry":
        voltage = _number(value.get("voltage"))
        current = _number(value.get("current"))
        return cls(
            voltage=voltage,
            current=current,
            power=_number(value.get("power"), voltage * current),
            lux=_number(value.get("lux", value.get("light"))),
            temperature=_number(value.get("temperature")),
            humidity=_number(value.get("humidity")),
            timestamp=value.get("timestamp"),
            device_id=value.get("device_id"),
        )


@dataclass(frozen=True)
class MLPrediction:
    fault_class: int | None = None
    fault_label: str | None = None
    efficiency_score: float | None = None
    maintenance_days: int | None = None

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "MLPrediction":
        value = value or {}
        raw_class = value.get("fault_class")
        return cls(
            fault_class=_integer(raw_class) if raw_class is not None else None,
            fault_label=value.get("fault_label"),
            efficiency_score=_number(value.get("efficiency_score")) if value.get("efficiency_score") is not None else None,
            maintenance_days=_integer(value.get("maintenance_days")) if value.get("maintenance_days") is not None else None,
        )


@dataclass(frozen=True)
class BaselineAssessment:
    """Observed output compared with the independently trained daylight baseline."""

    expected_power: float | None = None
    performance_ratio: float | None = None
    operational_status: str = "Not evaluated (low light)"

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "BaselineAssessment":
        value = value or {}
        expected_power = value.get("expected_power")
        performance_ratio = value.get("performance_ratio")
        return cls(
            expected_power=_number(expected_power) if expected_power is not None else None,
            performance_ratio=_number(performance_ratio) if performance_ratio is not None else None,
            operational_status=str(value.get("operational_status", "Not evaluated (low light)")),
        )


@dataclass(frozen=True)
class CandidateCause:
    cause: str
    severity: str
    evidence: tuple[str, ...]
    score: float


@dataclass(frozen=True)
class DiagnosticResult:
    health: str
    root_cause: str
    confidence: int
    severity: str
    evidence: tuple[str, ...] = field(default_factory=tuple)
    recommendation: str = "Continue monitoring the system."

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["evidence"] = list(self.evidence)
        return result


TelemetryInput = Telemetry | Mapping[str, Any]
HistoryInput = Sequence[Telemetry | Mapping[str, Any]]
PredictionInput = MLPrediction | Mapping[str, Any] | None
HardwareStatusInput = HardwareStatus | Mapping[str, Any] | None
BaselineInput = BaselineAssessment | Mapping[str, Any] | None
