"""Public entry point for the independent SolarShield diagnostics pipeline."""

from __future__ import annotations

from typing import Any, Mapping

from diagnostics.analyzer import DiagnosticsAnalyzer
from diagnostics.confidence import choose_best, score_candidate
from diagnostics.constants import HEALTH_LABELS
from diagnostics.models import (
    DiagnosticResult,
    HardwareStatus,
    HardwareStatusInput,
    HistoryInput,
    MLPrediction,
    PredictionInput,
    Telemetry,
    TelemetryInput,
)
from diagnostics.panel_health import evaluate_panel_health
from diagnostics.recommendations import recommendation_for
from diagnostics.rules import DiagnosticContext


def _telemetry(value: TelemetryInput) -> Telemetry:
    return value if isinstance(value, Telemetry) else Telemetry.from_mapping(value)


def _hardware_status(value: HardwareStatusInput) -> HardwareStatus:
    return value if isinstance(value, HardwareStatus) else HardwareStatus.from_mapping(value)


def _prediction(value: PredictionInput) -> MLPrediction:
    return value if isinstance(value, MLPrediction) else MLPrediction.from_mapping(value)


def _health_from_prediction_or_severity(prediction: MLPrediction, severity: str) -> str:
    if prediction.fault_label:
        return prediction.fault_label
    if prediction.fault_class is not None:
        return HEALTH_LABELS.get(prediction.fault_class, "Unknown")
    return "Fault" if severity == "High" else "Degraded"


def _health_for_panel(
    latest: Telemetry, panel_config: Mapping[str, Any] | None, fallback: str
) -> str:
    """Use saved ratings only when the configured panel has a complete rating."""
    if not panel_config:
        return fallback
    try:
        if float(panel_config.get("rated_voltage")) <= 0 or float(panel_config.get("rated_current")) <= 0:
            return fallback
    except (TypeError, ValueError):
        return fallback
    return evaluate_panel_health(latest.__dict__, panel_config)


class DiagnosticsEngine:
    """Run deterministic root-cause analysis without side effects or service dependencies."""

    def __init__(self, analyzer: DiagnosticsAnalyzer | None = None) -> None:
        self._analyzer = analyzer or DiagnosticsAnalyzer()

    def diagnose(
        self,
        latest_telemetry: TelemetryInput,
        historical_telemetry: HistoryInput = (),
        ml_prediction: PredictionInput = None,
        hardware_status: HardwareStatusInput = None,
        panel_config: Mapping[str, Any] | None = None,
    ) -> DiagnosticResult:
        latest = _telemetry(latest_telemetry)
        history = tuple(_telemetry(row) for row in historical_telemetry)
        prediction = _prediction(ml_prediction)
        context = DiagnosticContext(latest, history, _hardware_status(hardware_status))
        candidate = choose_best(self._analyzer.analyze(context))

        if candidate is None:
            health = _health_for_panel(
                latest,
                panel_config,
                prediction.fault_label or HEALTH_LABELS.get(prediction.fault_class, "Unknown"),
            )
            return DiagnosticResult(
                health=health,
                root_cause="No Fault Detected",
                confidence=0,
                severity="Low",
                recommendation=recommendation_for("No Fault Detected"),
            )

        # ML contributes the health label only. Rule evaluation and confidence
        # remain deterministic and independent of ML output.
        health = _health_for_panel(
            latest,
            panel_config,
            _health_from_prediction_or_severity(prediction, candidate.severity),
        )
        return DiagnosticResult(
            health=health,
            root_cause=candidate.cause,
            confidence=score_candidate(candidate),
            severity=candidate.severity,
            evidence=candidate.evidence,
            recommendation=recommendation_for(candidate.cause),
        )


def run_diagnostics(
    latest_telemetry: TelemetryInput,
    historical_telemetry: HistoryInput = (),
    ml_prediction: PredictionInput = None,
    hardware_status: HardwareStatusInput = None,
    panel_config: Mapping[str, Any] | None = None,
) -> DiagnosticResult:
    """Convenience function for callers that do not need to retain an engine instance."""
    return DiagnosticsEngine().diagnose(
        latest_telemetry,
        historical_telemetry,
        ml_prediction,
        hardware_status,
        panel_config,
    )
