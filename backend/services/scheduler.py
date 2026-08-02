from __future__ import annotations

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
from services.feature_eng import compute_features
from services.influx_client import InfluxClient
from services.ml_runner import MLRunner
from diagnostics import run_diagnostics
from services.admin_store import admin_store

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


class PredictionScheduler:
    def __init__(self, *, influx_client: InfluxClient, ml_runner: MLRunner) -> None:
        self._influx = influx_client
        self._ml_runner = ml_runner
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._started = False

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
        )
        self._scheduler.start()
        self._started = True

    def shutdown(self) -> None:
        if not self._started:
            return
        self._scheduler.shutdown(wait=False)
        self._started = False

    async def run_prediction_batch(self, device_id: str = DEFAULT_DEVICE_ID) -> None:
        try:
            if not self._ml_runner.is_ready():
                logger.warning("Skipping prediction batch because ML assets are not ready.")
                return

            df = self._influx.get_raw_data_last_minutes(device_id=device_id, minutes=30)
            if df.empty:
                logger.info("Skipping prediction batch because no recent sensor data is available.")
                return

            features = compute_features(df)
            prediction = self._ml_runner.predict(features)
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
                # Run diagnostics to attach evidence/recommendation to the alert.
                diagnostics_obj = None
                try:
                    latest_sensor = self._influx.get_latest_sensor(device_id=device_id) or {}
                    recent_df = df
                    recent_sensor_history = [
                        {
                            "timestamp": row["timestamp"].isoformat().replace("+00:00", "Z")
                            if hasattr(row["timestamp"], "isoformat")
                            else row["timestamp"],
                            "voltage": row["voltage"],
                            "current": row["current"],
                            "power": row["power"],
                            "lux": row["lux"],
                            "temperature": row["temperature"],
                            "humidity": row["humidity"],
                        }
                        for _, row in recent_df.iterrows()
                    ]
                    latest_hw = self._influx.get_latest_hardware_status(device_id)
                    panel_config = admin_store.get_panel_by_device_id(device_id)
                    diagnostics = run_diagnostics(
                        latest_telemetry=latest_sensor,
                        historical_telemetry=recent_sensor_history,
                        ml_prediction=prediction,
                        hardware_status=latest_hw,
                        panel_config=panel_config,
                    )
                    diagnostics_obj = diagnostics.to_dict() if diagnostics is not None else None
                except Exception:
                    diagnostics_obj = None

                self._influx.write_alert(
                    device_id=device_id,
                    alert_type="fault",
                    severity=_alert_severity(fault_class, efficiency_score),
                    message=_alert_message(prediction),
                    resolved=False,
                    timestamp=now_utc,
                    diagnostics=diagnostics_obj,
                )
        except Exception:
            logger.exception("Prediction batch failed.")


_prediction_scheduler: PredictionScheduler | None = None


def get_prediction_scheduler(
    *,
    influx_client: InfluxClient,
    ml_runner: MLRunner,
) -> PredictionScheduler:
    global _prediction_scheduler
    if _prediction_scheduler is None:
        _prediction_scheduler = PredictionScheduler(
            influx_client=influx_client,
            ml_runner=ml_runner,
        )
    return _prediction_scheduler
