# SolarShield

SolarShield is an end-to-end solar-panel monitoring system. ESP32 devices send
electrical and environmental telemetry to a FastAPI backend, which stores it in
InfluxDB, evaluates output against an expected-power baseline, and exposes
explainable diagnostics to a Next.js dashboard.

```text
ESP32 firmware → MQTT or HTTPS → FastAPI → InfluxDB
                                      ├→ Expected-power baseline
                                      ├→ Rule-based diagnostics
                                      └→ Next.js dashboard and admin tools
```

## Active monitoring approach

The project uses an expected-power baseline, not a supervised physical-fault
classifier. It estimates expected daylight power from lux, temperature,
humidity, and UTC time of day. The backend compares measured and expected power:

| Condition | Status |
| --- | --- |
| Lux below 5,000 | Not evaluated (low light) |
| Actual/expected at least 0.80 | Normal |
| Actual/expected from 0.50 to less than 0.80 | Underperforming |
| Actual/expected below 0.50 | Strong anomaly |

The deterministic diagnostics service combines this assessment with recent
telemetry and ESP32 hardware status to provide evidence, confidence, and a
maintenance recommendation. A low output signal alone is not proof of a
specific physical fault.

## Components

| Directory | Purpose |
| --- | --- |
| `firmware/` | ESP32 sketches for local logging, real monitoring, and MQTT test telemetry. |
| `backend/` | FastAPI APIs, MQTT/HTTPS ingestion, InfluxDB integration, scheduling, diagnostics, and Supabase admin APIs. |
| `frontend/` | Next.js monitoring dashboard, trends, alerts, maintenance, and admin pages. |
| `model/` | Real source data, cleaned telemetry, expected-power training script, and baseline artifacts. |

## Quick start

On Arch Linux, the repository provides a setup script that installs local
dependencies, starts Mosquitto and InfluxDB containers, starts the backend and
frontend, and optionally opens an ngrok HTTPS tunnel.

```bash
./arch_setup.sh install
./arch_setup.sh start
```

Or perform both steps together:

```bash
./arch_setup.sh all
```

Add Firebase credentials before using authenticated pages and add Supabase
service-role credentials before using administrator customer/panel management.
See the component READMEs for configuration and manual setup.

## Development checks

```bash
backend/.venv/bin/python -m compileall -q backend
cd frontend && npm exec tsc -- --noEmit
```

## Documentation

- [Backend setup and APIs](backend/README.md)
- [Firmware setup](firmware/README.md)
- [Frontend setup](frontend/README.md)
- [Model and diagnostics approach](model/README.md)

## Model limitations

The collected ESP32 dataset does not include verified labels for partial
shading, dust, panel damage, loose wiring, or long-term degradation. Therefore
the current model must be presented as an expected-power and anomaly-detection
baseline, not as a validated fault-cause classifier or maintenance forecast.
