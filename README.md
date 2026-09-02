# SolarShield — Solar Predictive Maintenance

SolarShield is an end-to-end solar-panel monitoring platform that turns live ESP32 telemetry into actionable maintenance insights. It combines real-time data ingestion, time-series storage, ML-based efficiency and fault analysis, and a dashboard for operators and administrators.

## Why it matters

Solar assets can lose output long before a failure is obvious. SolarShield helps spot abnormal performance early, investigate likely causes, and prioritize maintenance using live environmental and electrical readings.

## What’s included

- **ESP32 telemetry** collected over MQTT or HTTPS
- **FastAPI backend** for telemetry, diagnostics, predictions, alerts, and management APIs
- **InfluxDB and Mosquitto** services for time-series storage and messaging
- **Machine-learning pipeline** for expected-power estimation and predictive maintenance analysis
- **Next.js dashboard** for monitoring panel health, efficiency, alerts, and administration
- **Firebase authentication** and **Supabase-backed** customer/panel configuration

## Quick start (Arch Linux)

The repository includes a single setup script that installs the local dependencies and launches the development stack.

```bash
./arch_setup.sh install  # Arch packages, Python venv/pip, npm, Docker services
./arch_setup.sh start    # backend, frontend, ngrok
./arch_setup.sh all      # install + start (default)
```

`install` creates local backend and frontend environment files from their examples when they do not already exist. Add your Firebase and Supabase credentials before using authenticated or admin features. `start` runs the backend, frontend, and an ngrok tunnel; set `NGROK_AUTHTOKEN` first if your ngrok account requires it.

## Dataset

The solar-panel dataset used for this project is available on Kaggle:

[Solar Panel Dataset on Kaggle](https://www.kaggle.com/datasets/akshayhdev/solar-panel-dataset)

## Repository guide

| Directory | Purpose |
| --- | --- |
| `frontend/` | Next.js monitoring and administration dashboard |
| `backend/` | FastAPI application, data ingestion, alerts, diagnostics, and APIs |
| `firmware/` | ESP32 sensor-monitor firmware and test sketches |
| `model/` | Feature engineering, training, validation, and baseline ML artifacts |

For component-level setup and configuration details, see the READMEs in `backend/`, `firmware/`, and `model/`.
