# Expected-Power Baseline

This directory contains the presentation-safe SolarShield baseline trained from the cleaned real ESP32 dataset. It estimates expected daylight power from environmental conditions and time of day; it is not a multi-class fault classifier or a maintenance-days forecast.

## Purpose

The real collected data has no verified labels for partial shading, dust, panel damage, loose wiring, or panel degradation. A fault classifier cannot be validated without those labels. Instead, this model estimates expected power and calculates an underperformance signal:

```text
performance_ratio = actual_power / expected_power
```

| Ratio | Operational status |
|---:|---|
| At least 0.80 | Normal |
| 0.50 to less than 0.80 | Underperforming |
| Less than 0.50 | Strong anomaly |

These are operational thresholds, not confirmed fault labels. The diagnostics module should use telemetry and hardware status to provide evidence and recommendations.

## Artifacts

- `expected_power_model.pkl` — Random Forest expected-power regressor.
- `expected_power_feature_order.json` — Required inference feature order.
- `expected_power_metrics.json` — Reproducible held-out metrics and limitations.
- `expected_power_test_predictions.csv` — Actual/expected test-period values, residuals, ratios, and operational statuses.
- `expected_power_actual_vs_expected.png` — Chronological test-period chart for presentation.

## Reproduce

From the repository root:

```bash
backend/.venv/bin/python model/train_expected_power.py
```

The script reads `model/cleaned_data/cleaned_real_telemetry.csv`, keeps daylight samples at or above 5,000 lux, and uses an earliest-date 80% training / latest-date 20% test split. Its input features are `lux`, `temperature`, `humidity`, and cyclical hour-of-day features. It deliberately excludes power, voltage, current, and efficiency ratio from model inputs to avoid target leakage.

## Limitations

- The model is a baseline for expected daytime output, not a proof of panel condition.
- Low output can result from shading, dust, weather variation, wiring, measurement errors, or other conditions.
- Runtime inference must apply the same feature engineering and daylight threshold as the training script.
- Confirmed multi-class fault classification requires controlled or historical fault labels collected in the future.
