from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import (
    DEFAULT_DEVICE_ID,
    EFFICIENCY_ALERT_MAX_SCORE,
    FAULT_ALERT_MIN_CLASS,
    PREDICTION_BATCH_INTERVAL_SECONDS,
)
from services.influx_client import InfluxClient
from services.expected_power_runner import ExpectedPowerRunner
from diagnostics import run_diagnostics

logger = logging.getLogger(__name__)


def _alert_severity(fault_class: int, efficiency_score: float) -> str:
    if fault_class >= 2 or efficiency_score < 40:
        return "high"
    if fault_class >= 1 or efficiency_score < EFFICIENCY_ALERT_MAX_SCORE:
        return "medium"
    return "low"


def _alert_message(prediction: dict[str, object]) -> str:
    return (
        f"Prediction indicates {prediction['fault_label']} condition. "
        f"Efficiency score is {prediction['efficiency_score']:.1f} and "
        f"estimated maintenance is due in {prediction['maintenance_days']} days."
    )


def _prediction_from_assessment(baseline: dict[str, object], diagnostics) -> dict[str, object]:
    """Create a transparent prediction from measured vs expected power.

    The previous runtime models were trained without verified fault or
    maintenance labels. This mapping uses the independently trained expected
    daylight output and the deterministic diagnostics rules instead.
    """
    status = str(baseline.get("operational_status", "Not evaluated (low light)"))
    ratio = baseline.get("performance_ratio")

    if ratio is None or status == "Not evaluated (low light)":
        return {
            "fault_class": 0,
            "fault_label": "Monitoring",
            "efficiency_score": 100.0,
            "maintenance_days": 90,
        }

    efficiency_score = max(0.0, min(float(ratio) * 100.0, 100.0))
    if status == "Strong anomaly":
        fault_class, fault_label, maintenance_days = 2, "Fault", 0
    elif status == "Underperforming":
        fault_class, fault_label, maintenance_days = 1, "Degraded", 7
    else:
        fault_class, fault_label, maintenance_days = 0, "Normal", 90

    if diagnostics.severity == "High":
        fault_class, fault_label, maintenance_days = 2, "Fault", 0
    elif diagnostics.severity == "Medium":
        fault_class = max(fault_class, 1)
        fault_label = "Degraded" if fault_class == 1 else "Fault"
        maintenance_days = min(maintenance_days, 7)

    return {
        "fault_class": fault_class,
        "fault_label": fault_label,
        "efficiency_score": efficiency_score,
        "maintenance_days": maintenance_days,
    }


class PredictionScheduler:
    def __init__(self, *, influx_client: InfluxClient, expected_power_runner: ExpectedPowerRunner) -> None:
        self._influx = influx_client
        self._expected_power_runner = expected_power_runner
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._started = False
        self._run_lock = asyncio.Lock()

    def start(self) -> None:
        if self._started:
            return
        self._scheduler.add_job(
            self.run_prediction_batch,
            trigger=IntervalTrigger(seconds=PREDICTION_BATCH_INTERVAL_SECONDS, timezone="UTC"),
            id="run_prediction_batch",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            # Do not make a newly started backend wait one whole interval before
            # it can populate an empty predictions bucket.
            next_run_time=datetime.now(timezone.utc),
        )
        self._scheduler.start()
        self._started = True

    def shutdown(self) -> None:
        if not self._started:
            return
        self._scheduler.shutdown(wait=False)
        self._started = False

    async def run_prediction_batch(self, device_id: str = DEFAULT_DEVICE_ID) -> None:
        # The scheduled job and an on-demand first prediction can overlap after
        # a bucket reset. Serialize them so they do not write duplicate output.
        async with self._run_lock:
            await self._run_prediction_batch(device_id)

    async def _run_prediction_batch(self, device_id: str) -> None:
        try:
            if not self._expected_power_runner.is_ready():
                logger.warning("Skipping prediction batch because expected-power assets are not ready.")
                return

            df = self._influx.get_raw_data_last_minutes(device_id=device_id, minutes=30)
            if df.empty:
                logger.info("Skipping prediction batch because no recent sensor data is available.")
                return

            latest_sensor = self._influx.get_latest_sensor(device_id=device_id)
            if latest_sensor is None:
                logger.info("Skipping prediction batch because no complete latest sensor reading is available.")
                return

            baseline = self._expected_power_runner.predict(latest_sensor)
            history = df.to_dict(orient="records")
            hardware_status = self._influx.get_latest_hardware_status(device_id) or {}
            diagnostics = run_diagnostics(
                latest_telemetry=latest_sensor,
                historical_telemetry=history,
                hardware_status=hardware_status,
                baseline=baseline,
            )
            prediction = _prediction_from_assessment(baseline, diagnostics)
            now_utc = datetime.now(timezone.utc)

            self._influx.write_prediction(
                device_id=device_id,
                predicted_at=now_utc,
                fault_class=int(prediction["fault_class"]),
                fault_label=str(prediction["fault_label"]),
                efficiency_score=float(prediction["efficiency_score"]),
                maintenance_days=int(prediction["maintenance_days"]),
            )

            fault_class = int(prediction["fault_class"])
            efficiency_score = float(prediction["efficiency_score"])
            if fault_class >= FAULT_ALERT_MIN_CLASS or efficiency_score < EFFICIENCY_ALERT_MAX_SCORE:
                severity = _alert_severity(fault_class, efficiency_score)
                recent_alerts = self._influx.get_latest_alerts(device_id=device_id, limit=10)
                active_same_severity = any(
                    alert.get("type") == "fault"
                    and alert.get("severity") == severity
                    and not alert.get("resolved")
                    for alert in recent_alerts
                )
                if not active_same_severity:
                    self._influx.write_alert(
                        device_id=device_id,
                        alert_type="fault",
                        severity=severity,
                        message=_alert_message(prediction),
                        resolved=False,
                        timestamp=now_utc,
                        diagnostics=diagnostics.to_dict(),
                    )
            else:
                recent_alerts = self._influx.get_latest_alerts(device_id=device_id, limit=10)
                if any(alert.get("type") == "fault" and not alert.get("resolved") for alert in recent_alerts):
                    self._influx.write_alert(
                        device_id=device_id,
                        alert_type="fault",
                        severity="low",
                        message="Fault condition cleared. Performance has returned to the normal range.",
                        resolved=True,
                        timestamp=now_utc,
                        diagnostics=diagnostics.to_dict(),
                    )
        except Exception:
            logger.exception("Prediction batch failed.")


_prediction_scheduler: PredictionScheduler | None = None


def get_prediction_scheduler(
    *,
    influx_client: InfluxClient,
    expected_power_runner: ExpectedPowerRunner,
) -> PredictionScheduler:
    global _prediction_scheduler
    if _prediction_scheduler is None:
        _prediction_scheduler = PredictionScheduler(
            influx_client=influx_client,
            expected_power_runner=expected_power_runner,
        )
    return _prediction_scheduler
