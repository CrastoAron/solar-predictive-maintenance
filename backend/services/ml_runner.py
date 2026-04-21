from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from config import FEATURES_JSON_PATH, RF_MODEL_PATH, XGB_MODEL_PATH

FAULT_LABELS = ["Normal", "Degraded", "Fault"]


class MLRunner:
    def __init__(self) -> None:
        self.rf_model: Any | None = None
        self.xgb_model: Any | None = None
        self.feature_order: list[str] = []
        self._load_assets()

    def _load_assets(self) -> None:
        if FEATURES_JSON_PATH.exists():
            with open(FEATURES_JSON_PATH, "r", encoding="utf-8") as f:
                self.feature_order = json.load(f)["feature_order"]

        if RF_MODEL_PATH.exists():
            self.rf_model = joblib.load(RF_MODEL_PATH)

        if XGB_MODEL_PATH.exists():
            self.xgb_model = joblib.load(XGB_MODEL_PATH)

    def is_ready(self) -> bool:
        return bool(self.rf_model is not None and self.xgb_model is not None and self.feature_order)

    def predict(self, features: dict[str, float]) -> dict[str, Any]:
        if not self.is_ready():
            raise RuntimeError(
                "ML assets are not ready. Ensure rf_classifier.pkl, xgb_regressor.pkl, and features.json exist."
            )

        # Be tolerant to minor feature mismatches between training and runtime.
        # - Missing features are filled with 0.0
        # - Extra features are ignored
        row: dict[str, float] = {}
        for name in self.feature_order:
            val = features.get(name)
            row[name] = float(val) if val is not None else 0.0

        X = pd.DataFrame([row], columns=self.feature_order)

        fault_pred = self.rf_model.predict(X)
        fault_class = int(fault_pred[0]) if hasattr(fault_pred, "__len__") else int(fault_pred)
        fault_label = FAULT_LABELS[fault_class] if 0 <= fault_class < len(FAULT_LABELS) else "Unknown"

        reg_pred = self.xgb_model.predict(X)
        # Common shapes:
        # - (n_samples, 2) for multi-output regressors
        # - (n_samples,) for single-output regressors
        # - list/tuple of length 2 for a single sample
        first = reg_pred[0] if hasattr(reg_pred, "__len__") else reg_pred

        if isinstance(first, (list, tuple, np.ndarray)) and len(first) >= 2:
            efficiency_raw = float(first[0])
            maintenance_raw = float(first[1])
        else:
            # If the regressor only outputs efficiency, default maintenance to 30 days.
            efficiency_raw = float(first if not isinstance(first, (list, tuple, np.ndarray)) else first[0])
            maintenance_raw = 30.0

        efficiency_score = float(np.clip(efficiency_raw, 0, 100))
        maintenance_days = int(np.clip(round(maintenance_raw), 0, 365))

        return {
            "fault_class": fault_class,
            "fault_label": fault_label,
            "efficiency_score": efficiency_score,
            "maintenance_days": maintenance_days,
        }


_ml_runner: MLRunner | None = None


def get_ml_runner() -> MLRunner:
    global _ml_runner
    if _ml_runner is None:
        _ml_runner = MLRunner()
    return _ml_runner

