from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request

from config import DEFAULT_DEVICE_ID, EFFICIENCY_ALERT_MAX_SCORE, FAULT_ALERT_MIN_CLASS
from dependencies import get_current_user
from models.schemas import MaintenanceResponse
from diagnostics import run_diagnostics
from services.expected_power_runner import get_expected_power_runner
from services.influx_client import get_influx_client

router = APIRouter()


def _trend_label(values: list[float]) -> str:
    if len(values) < 2:
        # A freshly reset bucket has one valid baseline score. Present that as
        # stable until another prediction is available for a true comparison.
        return "stable"
    start = values[0]
    end = values[-1]
    if end < start:
        return "declining"
    if end > start:
        return "improving"
    return "stable"


_ALERT_PRIORITY = {"low": 1, "medium": 2, "high": 3}
_ALERT_MAINTENANCE_DAYS = {"low": 30, "medium": 7, "high": 0}
_DIAGNOSTIC_MAINTENANCE_DAYS = {"Medium": 7, "High": 0}


def _active_alert_summary(alerts: list[dict]) -> tuple[int, str | None, str | None]:
    active_alerts = [alert for alert in alerts if not alert.get("resolved")]
    if not active_alerts:
        return 0, None, None

    # The scheduler may emit repeated records for a continuing condition. Treat
    # those as one active condition rather than inflating the maintenance count.
    active_by_type: dict[str, dict] = {}
    for alert in active_alerts:
        alert_type = str(alert.get("type") or "fault")
        current = active_by_type.get(alert_type)
        if current is None or _ALERT_PRIORITY.get(str(alert.get("severity", "")).lower(), 0) > _ALERT_PRIORITY.get(str(current.get("severity", "")).lower(), 0):
            active_by_type[alert_type] = alert

    highest = max(
        active_by_type.values(),
        key=lambda alert: _ALERT_PRIORITY.get(str(alert.get("severity", "")).lower(), 0),
    )
    severity = str(highest.get("severity", "low")).lower()
    message = str(highest.get("message") or "An active system alert requires inspection.")
    return len(active_by_type), severity, message


def _alert_maintenance_days(days_remaining: int, severity: str | None) -> int:
    if severity is None:
        return days_remaining
    return min(days_remaining, _ALERT_MAINTENANCE_DAYS.get(severity, days_remaining))


def _is_prediction_stale(prediction: dict | None, telemetry: dict | None) -> bool:
    """Return true when a new sensor reading arrived after the ML prediction."""
    if prediction is None:
        return True
    if telemetry is None:
        return False
    try:
        predicted_at = str(prediction["predicted_at"]).replace("Z", "+00:00")
        telemetry_at = str(telemetry["timestamp"]).replace("Z", "+00:00")
        return datetime.fromisoformat(telemetry_at) > datetime.fromisoformat(predicted_at)
    except (KeyError, TypeError, ValueError):
        # A malformed timestamp must not prevent the scheduled prediction path.
        return prediction is None


@router.get("/api/maintenance", response_model=MaintenanceResponse | None)
async def get_maintenance(
    request: Request,
    device_id: str = Query(default=DEFAULT_DEVICE_ID),
    user: dict = Depends(get_current_user),
):
    influx = get_influx_client()
    latest = influx.get_latest_prediction(device_id=device_id)
    latest_sensor = influx.get_latest_sensor(device_id=device_id)
    if _is_prediction_stale(latest, latest_sensor):
        # Create an initial prediction after a bucket reset and refresh it when
        # fresh telemetry arrives, so the maintenance page reacts during a demo
        # instead of waiting for the five-minute background interval.
        scheduler = getattr(request.app.state, "prediction_scheduler", None)
        if scheduler is not None:
            await scheduler.run_prediction_batch(device_id=device_id)
            latest = influx.get_latest_prediction(device_id=device_id)
        if not latest:
            return None

    # Diagnostics must use the same expected-power baseline as /api/diagnostics.
    # It is optional here so a missing baseline asset does not hide ML maintenance data.
    try:
        recent_sensor_history_df = influx.get_raw_data_last_minutes(device_id=device_id, minutes=30)
        recent_sensor_history = recent_sensor_history_df.to_dict(orient="records")
        latest_hardware_status = influx.get_latest_hardware_status(device_id) or {}
        baseline = None
        runner = get_expected_power_runner()
        if latest_sensor is not None and runner.is_ready():
            baseline = runner.predict(latest_sensor)
        diagnostics = run_diagnostics(
            latest_telemetry=latest_sensor,
            historical_telemetry=recent_sensor_history,
            hardware_status=latest_hardware_status,
            baseline=baseline,
        )
    except Exception:
        diagnostics = None

    now_utc = datetime.now(timezone.utc)

    days_remaining = max(0, int(latest["maintenance_days"]))

    try:
        alerts = influx.get_latest_alerts(device_id=device_id, limit=50)
    except Exception:
        alerts = []
    active_alert_count, highest_alert_severity, alert_message = _active_alert_summary(alerts)
    days_remaining = _alert_maintenance_days(days_remaining, highest_alert_severity)

    try:
        scores = influx.get_efficiency_scores_last(device_id=device_id, limit=6)
    except Exception:
        scores = []
    trend = _trend_label([row["value"] for row in scores])

    fault_class = int(latest["fault_class"])
    efficiency_score = float(latest["efficiency_score"])

    if fault_class >= FAULT_ALERT_MIN_CLASS or efficiency_score < EFFICIENCY_ALERT_MAX_SCORE:
        recommendation = "Clean panel surface and check INA219 wiring"
    else:
        recommendation = "System operating normally. Continue monitoring solar panel performance."

    # Diagnostics-informed fields
    panel_health = None
    panel_damaged = None
    when_to_clean = None
    maintenance_trigger = None

    if diagnostics is not None:
        try:
            panel_health = diagnostics.health
            # Only a panel-damage diagnosis is evidence of physical panel damage.
            root = (diagnostics.root_cause or "").lower()
            panel_damaged = "panel damage" in root

            # Prefer diagnostics recommendation when available
            if diagnostics.recommendation:
                recommendation = diagnostics.recommendation

            diagnostic_due_days = _DIAGNOSTIC_MAINTENANCE_DAYS.get(diagnostics.severity)
            if diagnostic_due_days is not None:
                days_remaining = min(days_remaining, diagnostic_due_days)
                maintenance_trigger = (
                    f"{diagnostics.severity}-severity diagnostic: {diagnostics.root_cause}."
                )
        except Exception:
            # Ignore diagnostics failures and fall back to ML-derived values
            panel_health = None
            panel_damaged = None
            when_to_clean = None

    if highest_alert_severity:
        urgency = "immediate" if highest_alert_severity == "high" else "within 7 days" if highest_alert_severity == "medium" else "within 30 days"
        recommendation = f"Active {highest_alert_severity} alert: schedule maintenance {urgency}. {recommendation}"
        maintenance_trigger = f"Active {highest_alert_severity} alert."
        if panel_health in {None, "Normal", "Unknown"}:
            panel_health = "Attention Required"

    next_service_date = (now_utc + timedelta(days=days_remaining)).date().isoformat()

    if diagnostics is not None and diagnostics.recommendation and "clean" in diagnostics.recommendation.lower():
        when_to_clean = next_service_date

    return MaintenanceResponse(
        days_remaining=days_remaining,
        next_service_date=next_service_date,
        efficiency_trend=trend,
        recommendation=recommendation,
        when_to_clean=when_to_clean,
        panel_damaged=panel_damaged,
        panel_health=panel_health,
        active_alert_count=active_alert_count,
        highest_alert_severity=highest_alert_severity,
        alert_message=alert_message,
        maintenance_trigger=maintenance_trigger,
    )
