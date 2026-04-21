import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _getenv(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value


# MQTT
MQTT_HOST: str = _getenv("MQTT_HOST", "localhost")  # e.g. localhost
MQTT_PORT: int = int(_getenv("MQTT_PORT", "1883"))  # e.g. 1883
MQTT_TOPIC: str = _getenv("MQTT_TOPIC", "solar/sensors")  # hardware topic
MQTT_QOS: int = int(_getenv("MQTT_QOS", "1"))


# InfluxDB 2.x
INFLUX_URL: str | None = _getenv("INFLUX_URL")
INFLUX_TOKEN: str | None = _getenv("INFLUX_TOKEN")
INFLUX_ORG: str = _getenv("INFLUX_ORG", "solar_org") or "solar_org"

# Buckets as per your spec
INFLUX_BUCKET_RAW: str = _getenv("INFLUX_BUCKET_RAW", "solar_raw") or "solar_raw"
INFLUX_BUCKET_PREDICTIONS: str = (
    _getenv("INFLUX_BUCKET_PREDICTIONS", "solar_predictions") or "solar_predictions"
)
INFLUX_BUCKET_ALERTS: str = _getenv("INFLUX_BUCKET_ALERTS", "solar_alerts") or "solar_alerts"


# Scheduler (every 5 minutes)
PREDICTION_BATCH_INTERVAL_SECONDS: int = int(
    _getenv("PREDICTION_BATCH_INTERVAL_SECONDS", "300")
)


# Firebase (service account JSON)
FIREBASE_PROJECT_ID: str | None = _getenv("FIREBASE_PROJECT_ID")
FIREBASE_SERVICE_ACCOUNT_PATH: str = _getenv(
    "FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json"
) or "serviceAccountKey.json"


# CORS (Next.js dev)
try:
    _origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    CORS_ORIGINS: list[str] = [o.strip() for o in _origins.split(",") if o.strip()]
except Exception:
    CORS_ORIGINS = ["http://localhost:3000"]

# Default device id for when the frontend doesn't pass one yet
DEFAULT_DEVICE_ID: str = _getenv("DEFAULT_DEVICE_ID", "esp32-01") or "esp32-01"

# How far back to look when fetching "latest" rows (Flux requires a range).
INFLUX_LATEST_LOOKBACK: str = _getenv("INFLUX_LATEST_LOOKBACK", "30d") or "30d"


# Alert rule thresholds
FAULT_ALERT_MIN_CLASS: int = int(_getenv("FAULT_ALERT_MIN_CLASS", "1"))
EFFICIENCY_ALERT_MAX_SCORE: float = float(_getenv("EFFICIENCY_ALERT_MAX_SCORE", "60"))


# Paths
BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

# Prefer the canonical trained models in `model/ml_models/` if present.
# Fallback to `backend/ml_models/` for local/dev experiments.
_preferred_models_dir = REPO_ROOT / "model" / "ml_models"
ML_MODELS_DIR = _preferred_models_dir if _preferred_models_dir.exists() else (BASE_DIR / "ml_models")

RF_MODEL_PATH = Path(_getenv("RF_MODEL_PATH", str(ML_MODELS_DIR / "rf_classifier.pkl")))
XGB_MODEL_PATH = Path(_getenv("XGB_MODEL_PATH", str(ML_MODELS_DIR / "xgb_regressor.pkl")))
FEATURES_JSON_PATH = Path(_getenv("FEATURES_JSON_PATH", str(ML_MODELS_DIR / "features.json")))

