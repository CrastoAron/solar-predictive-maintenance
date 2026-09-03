# Expected-Power Baseline Artifacts

This directory contains the SolarShield expected-power baseline trained from
cleaned real ESP32 telemetry. It is the runtime model used by the backend's
`/api/expected-power`, diagnostics, scheduler, and baseline-aware simulator.

It is not a multi-class fault classifier or a maintenance-days forecast.

## Runtime artifacts

| File | Purpose |
| --- | --- |
| `expected_power_model.pkl` | Random Forest regressor used at runtime. |
| `expected_power_feature_order.json` | Exact input-feature order for inference. |
| `expected_power_metrics.json` | Held-out metrics and documented limitations. |
| `expected_power_test_predictions.csv` | Actual versus expected values for the test period. |
| `expected_power_actual_vs_expected.png` | Presentation chart for the chronological test period. |

## Inputs and output

Inputs are lux, temperature, humidity, and cyclical UTC hour-of-day features.
Power, voltage, current, and derived efficiency measures are excluded from
training inputs to prevent target leakage.

The backend derives:

```text
performance_ratio = actual_power / expected_power
```

At lux below 5,000, the backend does not run the daylight baseline and returns
`Not evaluated (low light)` with null expected power and performance ratio.

## Reproduce

From the repository root:

```bash
backend/.venv/bin/python model/train_expected_power.py
```

The script uses `model/cleaned_data/cleaned_real_telemetry.csv` and an earliest
80% / latest 20% chronological split by calendar date.

## Interpretation

The artifacts estimate expected daytime output only. Underperformance can come
from shading, soiling, weather, wiring, sensor error, or other conditions. The
diagnostics service must provide the supporting evidence and should report a
low-output anomaly when no physical cause is confirmed.
