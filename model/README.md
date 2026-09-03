# SolarShield Model Module

This directory contains the expected-power baseline used by SolarShield. It is
an anomaly-detection aid, not a supervised fault classifier or maintenance-day
forecast.

## Model approach

The ESP32 dataset has no verified labels for partial shading, dust, panel
damage, loose wiring, or degradation. The baseline therefore estimates expected
daylight power from lux, temperature, humidity, and UTC time of day.

```text
performance_ratio = actual_power / expected_power
```

| Condition | Operational status |
| --- | --- |
| Lux below 5,000 | Not evaluated (low light) |
| Ratio at least 0.80 | Normal |
| Ratio from 0.50 to less than 0.80 | Underperforming |
| Ratio below 0.50 | Strong anomaly |

The backend diagnostics service combines this signal with recent telemetry and
ESP32 hardware status. A low output result is not proof of a physical cause.

## Layout

```text
model/
├── data/                   # Original ESP32 collection CSVs (source/audit data)
├── cleaned_data/           # Cleaned canonical real telemetry dataset
├── baseline_models/        # Model, metrics, feature order, and test evidence
└── train_expected_power.py # Reproducible training script
```

## Re-train

From the repository root:

```bash
backend/.venv/bin/python model/train_expected_power.py
```

The script reads `cleaned_data/cleaned_real_telemetry.csv`, trains on daylight
rows at or above 5,000 lux, uses a chronological date-based split, and writes
the runtime assets to `baseline_models/`.

## Generate engineering analysis graphs

`solar_analysis.py` recursively discovers CSV, Excel, JSON, and Parquet files,
detects common telemetry columns, prints an inspection report, and generates
only graphs supported by the available measurements.

```bash
backend/.venv/bin/python model/solar_analysis.py
```

By default it analyzes `cleaned_data/` and writes high-resolution PNG graphs,
`analysis_summary.txt`, and `correlations.csv` to `model/graphs/`. Supply a
different file or directory and output location when analysing a replacement
dataset:

```bash
backend/.venv/bin/python model/solar_analysis.py ./new_data --output ./graphs
```

Actual-vs-predicted power is created only when the selected dataset already has
a prediction column. A compatible joblib model can be used deliberately with
`--model` and, if needed, `--feature-order`; the script never loads a model by
default.

## Limitations

- The model does not identify a verified physical fault cause.
- Thresholds require calibration as more field data is collected.
- A validated cause classifier needs controlled or historically confirmed fault
  labels before training.
