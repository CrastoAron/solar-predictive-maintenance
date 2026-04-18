"""
SolarShield — ML Router
========================
File  : app/routers/ml_router.py
Prefix: /ml
Auth  : NONE (backend handles Firebase token verification before calling this router)

Endpoints
---------
POST /ml/classify   → { fault_class, fault_label }
POST /ml/forecast   → { efficiency_score, maintenance_days }

The `predict()` function is also importable by ml_runner.py in the backend:
    from app.routers.ml_router import predict
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE_DIR      = Path(__file__).resolve().parent.parent.parent  # repo root
_MODELS_DIR    = _BASE_DIR / "ml_models"
_RF_PATH       = _MODELS_DIR / "rf_classifier.pkl"
_XGB_PATH      = _MODELS_DIR / "xgb_regressor.pkl"
_FEATURES_PATH = _MODELS_DIR / "features.json"

# ── Load once at module import (not per-request) ──────────────────────────────
def _load_models():
    """Load both pkl files and features.json. Raises on missing files."""
    if not _FEATURES_PATH.exists():
        raise FileNotFoundError(
            f"features.json not found at {_FEATURES_PATH}. "
            "Run notebooks 01–03 first to generate ml_models/."
        )
    if not _RF_PATH.exists():
        raise FileNotFoundError(f"rf_classifier.pkl not found at {_RF_PATH}.")
    if not _XGB_PATH.exists():
        raise FileNotFoundError(f"xgb_regressor.pkl not found at {_XGB_PATH}.")

    with open(_FEATURES_PATH) as f:
        feature_order: list[str] = json.load(f)["feature_order"]

    rf_model  = joblib.load(_RF_PATH)
    xgb_model = joblib.load(_XGB_PATH)

    logger.info("ML models loaded. Feature order: %s", feature_order)
    return rf_model, xgb_model, feature_order


try:
    rf_model, xgb_model, FEATURE_ORDER = _load_models()
    _MODELS_READY = True
except FileNotFoundError as _e:
    logger.warning(
        "ML models not yet available (%s). "
        "/ml/ endpoints will return 503 until models are trained.",
        _e,
    )
    rf_model = xgb_model = FEATURE_ORDER = None  # type: ignore[assignment]
    _MODELS_READY = False

# ── Fault label map ───────────────────────────────────────────────────────────
_FAULT_LABELS: dict[int, str] = {0: "Normal", 1: "Degraded", 2: "Fault"}

# ── Pydantic input schema ─────────────────────────────────────────────────────
class SolarFeatures(BaseModel):
    """All 12 engineered features — must match features.json order exactly."""

    voltage_mean:           float = Field(..., description="Rolling 30-min mean of voltage (V)")
    voltage_std:            float = Field(..., description="Rolling 30-min std of voltage")
    current_mean:           float = Field(..., description="Rolling 30-min mean of current (A)")
    current_std:            float = Field(..., description="Rolling 30-min std of current")
    power_mean:             float = Field(..., description="Rolling 30-min mean of power (W)")
    power_std:              float = Field(..., description="Rolling 30-min std of power")
    lux_mean:               float = Field(..., description="Rolling 30-min mean of irradiance (lux)")
    temperature_mean:       float = Field(..., description="Rolling 30-min mean of temperature (°C)")
    humidity_mean:          float = Field(..., description="Rolling 30-min mean of humidity (%)")
    power_rate_of_change:   float = Field(..., description="(last_power - first_power) / elapsed_minutes")
    voltage_rate_of_change: float = Field(..., description="(last_voltage - first_voltage) / elapsed_minutes")
    efficiency_ratio:       float = Field(..., description="power_mean / (lux_mean / 1000 + 0.001)")

    model_config = {"json_schema_extra": {
        "example": {
            "voltage_mean": 24.5,
            "voltage_std": 0.2,
            "current_mean": 3.8,
            "current_std": 0.1,
            "power_mean": 93.0,
            "power_std": 2.0,
            "lux_mean": 85000.0,
            "temperature_mean": 28.0,
            "humidity_mean": 55.0,
            "power_rate_of_change": 0.1,
            "voltage_rate_of_change": 0.0,
            "efficiency_ratio": 1.094,
        }
    }}


# ── Core predict function (importable by ml_runner.py) ────────────────────────
def predict(features: dict) -> dict:
    """
    Run both models on a single feature dict and return combined predictions.

    Parameters
    ----------
    features : dict
        Must contain all 12 keys listed in FEATURE_ORDER.

    Returns
    -------
    dict with keys:
        fault_class      : int   (0 = Normal, 1 = Degraded, 2 = Fault)
        fault_label      : str
        efficiency_score : float (clipped to [0, 100])
        maintenance_days : int   (clipped to [0, 365])
    """
    if not _MODELS_READY:
        raise RuntimeError(
            "ML models are not loaded. Train and save .pkl files first."
        )

    # Build DataFrame with exact feature order
    X = pd.DataFrame([features])[FEATURE_ORDER]

    # ── Classifier ────────────────────────────────────────────────────────────
    fault_class = int(rf_model.predict(X)[0])
    fault_label = _FAULT_LABELS.get(fault_class, "Unknown")

    # ── Regressor ─────────────────────────────────────────────────────────────
    xgb_out          = xgb_model.predict(X)[0]          # shape (2,)
    efficiency_score = float(np.clip(xgb_out[0], 0, 100))
    maintenance_days = int(np.clip(round(xgb_out[1]), 0, 365))

    return {
        "fault_class":      fault_class,
        "fault_label":      fault_label,
        "efficiency_score": efficiency_score,
        "maintenance_days": maintenance_days,
    }


# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/ml", tags=["ML Inference"])


def _check_models_ready():
    if not _MODELS_READY:
        raise HTTPException(
            status_code=503,
            detail=(
                "ML models not yet available. "
                "Run notebooks 01–03 to train and save the .pkl files, "
                "then restart the backend."
            ),
        )


@router.post(
    "/classify",
    summary="Fault classification",
    response_description="Fault class (0=Normal, 1=Degraded, 2=Fault) and human-readable label",
)
def classify(body: SolarFeatures):
    """
    Classify the current solar panel operating state using the Random Forest model.

    - **fault_class**: `0` Normal · `1` Degraded · `2` Fault
    - **fault_label**: Human-readable string
    """
    _check_models_ready()

    features = body.model_dump()
    X = pd.DataFrame([features])[FEATURE_ORDER]

    fault_class = int(rf_model.predict(X)[0])
    fault_label = _FAULT_LABELS.get(fault_class, "Unknown")

    return {"fault_class": fault_class, "fault_label": fault_label}


@router.post(
    "/forecast",
    summary="Efficiency & maintenance forecast",
    response_description="Predicted efficiency score and days until next maintenance",
)
def forecast(body: SolarFeatures):
    """
    Predict efficiency score and maintenance countdown using the XGBoost regressor.

    - **efficiency_score**: Float in `[0, 100]` — percentage of rated power being achieved
    - **maintenance_days**: Int in `[0, 365]` — estimated days until next maintenance
    """
    _check_models_ready()

    features = body.model_dump()
    X = pd.DataFrame([features])[FEATURE_ORDER]

    xgb_out          = xgb_model.predict(X)[0]
    efficiency_score = float(np.clip(xgb_out[0], 0, 100))
    maintenance_days = int(np.clip(round(xgb_out[1]), 0, 365))

    return {
        "efficiency_score": efficiency_score,
        "maintenance_days": maintenance_days,
    }


@router.get("/health", summary="Health check for ML subsystem")
def ml_health():
    """Returns whether the ML models are loaded and ready."""
    return {
        "models_ready":   _MODELS_READY,
        "feature_count":  len(FEATURE_ORDER) if FEATURE_ORDER else 0,
        "classifier_pkl": str(_RF_PATH),
        "regressor_pkl":  str(_XGB_PATH),
    }
