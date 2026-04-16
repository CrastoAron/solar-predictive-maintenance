from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.dummy import DummyRegressor
from sklearn.multioutput import MultiOutputRegressor


def main() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    ml_dir = backend_dir / "ml_models"
    ml_dir.mkdir(parents=True, exist_ok=True)

    feature_order = [
        "voltage_mean",
        "voltage_std",
        "current_mean",
        "current_std",
        "power_mean",
        "power_std",
        "lux_mean",
        "temperature_mean",
        "humidity_mean",
        "power_rate_of_change",
        "voltage_rate_of_change",
        "efficiency_ratio",
    ]

    # Train on tiny synthetic data just to create pickles with the right interfaces.
    rng = np.random.default_rng(7)
    X = rng.normal(size=(64, len(feature_order))).astype(float)

    # Fault classes: 0=Normal, 1=Degraded, 2=Fault
    y_cls = rng.integers(low=0, high=3, size=(64,))
    rf = DummyClassifier(strategy="most_frequent")
    rf.fit(X, y_cls)

    # Two regression outputs: [efficiency_score (0..100), maintenance_days (0..365)]
    y_reg = np.column_stack(
        [
            rng.uniform(40, 95, size=(64,)),
            rng.integers(0, 120, size=(64,)),
        ]
    ).astype(float)
    xgb_like = MultiOutputRegressor(DummyRegressor(strategy="mean"))
    xgb_like.fit(X, y_reg)

    (ml_dir / "features.json").write_text(
        json.dumps({"feature_order": feature_order}, indent=2) + "\n",
        encoding="utf-8",
    )
    joblib.dump(rf, ml_dir / "rf_classifier.pkl")
    joblib.dump(xgb_like, ml_dir / "xgb_regressor.pkl")

    print(f"Wrote dummy ML assets to {ml_dir}")


if __name__ == "__main__":
    main()

