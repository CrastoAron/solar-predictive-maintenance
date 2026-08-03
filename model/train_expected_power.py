"""Train an honest expected-power baseline from cleaned SolarShield telemetry.

This intentionally does not train a fault classifier. The dataset contains normal
operation telemetry but no verified fault labels. The model estimates expected
panel power from environmental and time-of-day inputs, then the residual can be
used as an explainable underperformance signal.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
# The workspace home directory is read-only in some environments; use a
# writable temporary cache for matplotlib instead of failing chart generation.
os.environ.setdefault("MPLCONFIGDIR", "/tmp/solarshield-matplotlib")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


RANDOM_STATE = 42
DAYLIGHT_LUX_MIN = 5_000.0
EXPECTED_POWER_FLOOR_W = 0.10

BASE_DIR = Path(__file__).resolve().parent
INPUT_PATH = BASE_DIR / "cleaned_data" / "cleaned_real_telemetry.csv"
OUTPUT_DIR = BASE_DIR / "baseline_models"

FEATURE_COLUMNS = ["lux", "temperature", "humidity", "hour_sin", "hour_cos"]


def add_time_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add cyclical time-of-day features without using future measurements."""
    result = frame.copy()
    result["timestamp"] = pd.to_datetime(result["timestamp"], utc=True, errors="raise")
    hour = result["timestamp"].dt.hour + result["timestamp"].dt.minute / 60.0
    angle = 2.0 * np.pi * hour / 24.0
    result["hour_sin"] = np.sin(angle)
    result["hour_cos"] = np.cos(angle)
    result["date"] = result["timestamp"].dt.date
    return result


def classify_performance(actual: pd.Series, expected: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return a bounded ratio and an operational status, not a fault label."""
    safe_expected = np.maximum(expected, EXPECTED_POWER_FLOOR_W)
    ratio = actual.to_numpy() / safe_expected
    status = np.select(
        [ratio >= 0.80, ratio >= 0.50],
        ["Normal", "Underperforming"],
        default="Strong anomaly",
    )
    return ratio, status


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Cleaned dataset not found: {INPUT_PATH}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frame = pd.read_csv(INPUT_PATH)
    frame = add_time_features(frame)

    # Low/zero illumination is normal nighttime behaviour and is intentionally
    # outside the expected-power modelling task.
    daylight = frame.loc[frame["lux"] >= DAYLIGHT_LUX_MIN].copy()
    if daylight.empty:
        raise ValueError("No daylight rows are available for the configured lux threshold.")

    dates = np.array(sorted(daylight["date"].unique()))
    if len(dates) < 3:
        raise ValueError("At least three distinct dates are required for a chronological split.")

    split_index = max(1, int(len(dates) * 0.80))
    split_index = min(split_index, len(dates) - 1)
    train_dates = dates[:split_index]
    test_dates = dates[split_index:]
    train = daylight.loc[daylight["date"].isin(train_dates)].copy()
    test = daylight.loc[daylight["date"].isin(test_dates)].copy()

    model = RandomForestRegressor(
        n_estimators=300,
        min_samples_leaf=3,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(train[FEATURE_COLUMNS], train["power"])

    expected_power = model.predict(test[FEATURE_COLUMNS])
    ratio, operational_status = classify_performance(test["power"], expected_power)
    residual = test["power"].to_numpy() - expected_power

    metrics = {
        "task": "Expected daylight power baseline; not a fault classifier or maintenance forecast.",
        "input_dataset": str(INPUT_PATH.relative_to(BASE_DIR)),
        "feature_columns": FEATURE_COLUMNS,
        "target_column": "power",
        "daylight_lux_min": DAYLIGHT_LUX_MIN,
        "split_strategy": "Chronological split by distinct calendar date: earliest 80% train, latest 20% test.",
        "train_date_range": [str(train_dates[0]), str(train_dates[-1])],
        "test_date_range": [str(test_dates[0]), str(test_dates[-1])],
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "metrics": {
            "mae_watts": float(mean_absolute_error(test["power"], expected_power)),
            "rmse_watts": float(mean_squared_error(test["power"], expected_power) ** 0.5),
            "r2": float(r2_score(test["power"], expected_power)),
        },
        "operational_status_counts": pd.Series(operational_status).value_counts().to_dict(),
        "limitations": [
            "The source data has no verified physical fault labels.",
            "A low performance ratio is an underperformance signal, not proof of a specific fault.",
            "Runtime inference must apply the same timestamp feature engineering and daylight threshold.",
        ],
    }

    predictions = test[["timestamp", "power", "lux", "temperature", "humidity", "source_file", "source_row"]].copy()
    predictions = predictions.rename(columns={"power": "actual_power"})
    predictions["expected_power"] = expected_power
    predictions["power_residual"] = residual
    predictions["performance_ratio"] = ratio
    predictions["operational_status"] = operational_status
    predictions.to_csv(OUTPUT_DIR / "expected_power_test_predictions.csv", index=False, float_format="%.6f")

    joblib.dump(model, OUTPUT_DIR / "expected_power_model.pkl")
    (OUTPUT_DIR / "expected_power_feature_order.json").write_text(
        json.dumps({"feature_order": FEATURE_COLUMNS}, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUTPUT_DIR / "expected_power_metrics.json").write_text(
        json.dumps(metrics, indent=2) + "\n",
        encoding="utf-8",
    )

    ordered = predictions.sort_values("timestamp")
    figure, axis = plt.subplots(figsize=(12, 5))
    # Scatter points avoid drawing false lines across multi-day collection gaps.
    axis.scatter(ordered["timestamp"], ordered["actual_power"], label="Actual power", color="#2563eb", s=16, alpha=0.75)
    axis.scatter(ordered["timestamp"], ordered["expected_power"], label="Expected power", color="#f97316", s=16, alpha=0.75)
    axis.set_title("Expected Power Baseline — Chronological Test Period")
    axis.set_xlabel("Timestamp")
    axis.set_ylabel("Power (W)")
    axis.legend()
    axis.grid(alpha=0.25)
    figure.autofmt_xdate()
    figure.tight_layout()
    figure.savefig(OUTPUT_DIR / "expected_power_actual_vs_expected.png", dpi=160)
    plt.close(figure)

    print(json.dumps(metrics, indent=2))
    print(f"Saved baseline artifacts to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
