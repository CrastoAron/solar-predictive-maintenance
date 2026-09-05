# SolarShield Backend

SolarShield's backend is a **FastAPI** service for solar panel monitoring. It ingests live telemetry, stores it in **InfluxDB**, compares actual output against an expected-power baseline, runs explainable rule-based diagnostics, and serves REST APIs for a dashboard plus administrator tooling backed by **Supabase**.

---

## Table of contents

- [What this backend does](#what-this-backend-does)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running locally](#running-locally)
- [Telemetry ingestion contract](#telemetry-ingestion-contract)
- [Model and diagnostics](#model-and-diagnostics)
- [API reference](#api-reference)
- [Simulating telemetry](#simulating-telemetry)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## What this backend does

- **Ingests live sensor readings** via MQTT and stores them in InfluxDB 2.x
- **Accepts ESP32 telemetry** directly over HTTP(S) at `POST /api/telemetry` (including through an ngrok tunnel), independent of MQTT
- **Captures optional hardware diagnostics** (BME280, INA219, BH1750, DS3231 status codes) from telemetry payloads
- **Calculates expected daylight power** from lux, temperature, humidity, and time of day, and derives an operational status by comparing it to actual output
- **Runs deterministic, explainable diagnostics** — root cause, evidence, confidence score, severity, and a maintenance recommendation
- **Serves REST APIs** for live values, history, expected power, diagnostics, alerts, hardware status, and maintenance guidance
- **Provides administrator APIs** (Firebase-admin-protected) for managing customers, panel arrays, and panels, persisted in Supabase
- **Runs a background scheduler** that periodically evaluates recent telemetry and records derived status/alerts for the dashboard

## Tech stack

| Layer | Technology |
| --- | --- |
| API | FastAPI + Uvicorn (`main.py`) |
| Auth (dashboard) | Firebase Admin — Bearer ID token required for `/api/*` |
| Auth (admin) | Firebase Admin with admin role, for `/admin/*` |
| Time-series storage | InfluxDB 2.x |
| Admin data store | Supabase (Postgres) |
| Ingestion | MQTT (Paho client) |
| Scheduler | APScheduler (AsyncIO) |
| Baseline model | `joblib`-loaded expected-power model |
| Diagnostics | Deterministic, rule-based (standard-library only) |

## Repository layout

```
backend/
├── main.py                     # FastAPI app + startup/shutdown lifecycle
├── config.py                   # Environment variables and defaults
├── dependencies.py             # Auth dependency (get_current_user)
├── routers/                    # API routes
├── services/
│   ├── mqtt_client.py          # Subscribes to MQTT, writes points to InfluxDB
│   ├── influx_client.py        # Read/write ops for raw data, predictions, alerts
│   ├── feature_eng.py          # Feature computation from recent sensor windows
│   ├── ml_runner.py            # Loads baseline/ML assets, produces predictions
│   ├── scheduler.py            # Periodic batch evaluation job
│   └── firebase_admin.py       # Firebase token verification
├── diagnostics/                # Independent, deterministic root-cause analysis module
├── model/baseline_models/      # Expected-power baseline model assets
├── scripts/
│   ├── generate_dummy_models.py    # Generates test model assets for local dev
│   ├── simulate_sensor.py          # Publishes simulated readings over MQTT
│   └── simulate_sensor_ngrok.py    # Posts simulated readings over HTTPS via ngrok
└── supabase/schema.sql         # Supabase schema for the admin data store
```

The `diagnostics/` module is independent and deterministic — it does not alter MQTT ingestion, InfluxDB storage, the baseline model, API routes, or the frontend. It consumes current telemetry, historical telemetry, an optional baseline prediction, and hardware-status values, and returns an explainable result. It can detect:

- Sensor Failure
- Partial Shading
- Dust Accumulation
- Panel Degradation
- Possible Panel Damage
- Loose Wiring
- Low-output anomaly (used when a deviation exists but the cause can't be proven from telemetry)

## Requirements

- Python 3.10+
- InfluxDB 2.x reachable from this service
- MQTT broker reachable from this service (e.g. Mosquitto)
- Firebase service-account JSON, for authenticated dashboard and admin APIs
- Supabase project URL and service-role key, for the admin data store

## Installation

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Create `backend/.env` (you can start from `.env.example` if present) and set the values below. The backend loads it via `python-dotenv`, or you can export the variables in your shell.

### InfluxDB (required)

| Variable | Default | Notes |
| --- | --- | --- |
| `INFLUX_URL` | — | Required |
| `INFLUX_TOKEN` | — | Required |
| `INFLUX_ORG` | `solar_org` | |
| `INFLUX_BUCKET_RAW` | `solar_raw` | |
| `INFLUX_BUCKET_PREDICTIONS` | `solar_predictions` | |
| `INFLUX_BUCKET_ALERTS` | `solar_alerts` | |
| `INFLUX_LATEST_LOOKBACK` | `30d` | |

### MQTT (required)

| Variable | Default |
| --- | --- |
| `MQTT_HOST` | `localhost` |
| `MQTT_PORT` | `1883` |
| `MQTT_TOPIC` | `solar/sensors` |
| `MQTT_QOS` | `1` |
| `ESP32_NAIVE_TIMESTAMP_UTC_OFFSET_MINUTES` | `330` (UTC offset applied only to legacy ESP32 timestamps with no `Z`/offset; ISO/RFC3339 timestamps with a timezone are always converted correctly) |

### Firebase auth (required for `/api/*` and `/admin/*`)

| Variable | Default | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `serviceAccountKey.json` | |
| `FIREBASE_PROJECT_ID` | — | Optional; if set, token audience is validated |

### Supabase admin store (required for `/admin/*`)

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Never expose via `NEXT_PUBLIC_*`, never place in frontend code, never commit it. This key bypasses the RLS policies that protect browser clients. |

Administrator authentication uses Supabase Auth email/password. After creating
an administrator in Supabase Authentication, insert that user's UUID into
`public.admin_users` with role `admin`:

```sql
insert into public.admin_users (user_id, email)
values ('SUPABASE_AUTH_USER_UUID', 'admin@example.com');
```

The `/admin/customers` endpoint uses Firebase Admin to discover users linked to
the `google.com` provider and synchronizes those users into `public.customers`.

Setup steps:

1. In Supabase, open the target project → **SQL Editor**.
2. Copy the contents of `supabase/schema.sql` and run it in the SQL Editor. It creates `customers`, `panel_arrays`, and `panels`, plus their relationships, indexes, and RLS configuration.
3. In **Project Settings → API**, copy the project URL and the **service_role** secret key (not the `anon`/publishable key).
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` and restart the backend.

Troubleshooting the admin store:

- `PGRST205: Could not find the table public.customers` → the schema wasn't applied; run `supabase/schema.sql` again.
- `new row violates row-level security policy` → the backend is using the anon key instead of the service-role key; fix `SUPABASE_SERVICE_ROLE_KEY` and restart.
- If Supabase is configured but broken, the backend returns database errors intentionally — it does **not** fall back to in-memory customer/panel records.

### Scheduler and alerts

| Variable | Default |
| --- | --- |
| `PREDICTION_BATCH_INTERVAL_SECONDS` | `300` |
| `DEFAULT_DEVICE_ID` | `esp32-01` |
| `FAULT_ALERT_MIN_CLASS` | `1` |
| `EFFICIENCY_ALERT_MAX_SCORE` | `60` |

### Baseline / model assets

| Variable | Default (relative to `backend/`) |
| --- | --- |
| `EXPECTED_POWER_MODEL_PATH` | `backend/ml_models/rf_classifier.pkl` equivalent — see `model/baseline_models/` |
| `EXPECTED_POWER_FEATURES_PATH` | `backend/ml_models/features.json` |
| `EXPECTED_POWER_DAYLIGHT_LUX_MIN` | Used to gate "low light" evaluation |
| `RF_MODEL_PATH` | `backend/ml_models/rf_classifier.pkl` |
| `XGB_MODEL_PATH` | `backend/ml_models/xgb_regressor.pkl` |
| `FEATURES_JSON_PATH` | `backend/ml_models/features.json` |

## Running locally

### 1. Start dependencies

**Mosquitto (MQTT broker):**

```bash
# Clean up any conflicting network/container
docker stop mosquitto 2>/dev/null || true
docker rm mosquitto 2>/dev/null || true
docker network rm my_mqtt_net 2>/dev/null || true

# Create a dedicated bridge network
docker network create --subnet=192.168.137.0/24 my_mqtt_net

# Run Mosquitto with a static IP and mounted config
docker run -d \
  --name mosquitto \
  --network my_mqtt_net \
  --ip 192.168.137.50 \
  -p 1883:1883 \
  -v $(pwd)/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  eclipse-mosquitto:2
```

**InfluxDB 2.x:**

```bash
docker run -d --name influxdb2 -p 8086:8086 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=adminadmin \
  -e DOCKER_INFLUXDB_INIT_ORG=solar_org \
  -e DOCKER_INFLUXDB_INIT_BUCKET=solar_raw \
  -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=solarshield \
  influxdb:2
```

If they don't already exist, create the remaining buckets in the Influx UI: `solar_predictions`, `solar_alerts`.

> On Arch Linux, [`arch_setup.sh`](../arch_setup.sh) in the repository root can automate the Docker services, application processes, and the ngrok tunnel.

### 2. Export environment variables

```bash
cd backend
source .env   # if backend/.env contains `export ...` lines
```

At minimum ensure `INFLUX_URL`, `INFLUX_TOKEN`, and `INFLUX_ORG` are set.

### 3. (Optional) Generate dummy model assets

If you don't have real trained assets yet:

```bash
cd backend
source .venv/bin/activate
python3 scripts/generate_dummy_models.py
```

This creates `backend/ml_models/features.json`, `rf_classifier.pkl`, and `xgb_regressor.pkl`.

### 4. Start the API server

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check (no auth):

```bash
curl http://localhost:8000/health
```

### 5. Expose the API to an ESP32 with ngrok HTTPS

Keep the server above running, then in a second terminal:

```bash
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>   # once per machine
ngrok http 8000
```

Keep the authtoken out of source control — the ngrok CLI stores it, not this repository. `ngrok http 8000` prints a forwarding address such as `https://example.ngrok-free.app`; ngrok terminates HTTPS and forwards to the local Uvicorn server. Use that address for the ESP32's telemetry URL:

```text
https://example.ngrok-free.app/api/telemetry
```

Verify the tunnel:

```bash
curl --request POST https://example.ngrok-free.app/api/telemetry \
  --header "Content-Type: application/json" \
  --data '{"device_id":"esp32-01","timestamp":"2026-08-30T12:00:00Z","voltage":18.2,"current":1.4,"lux":45000,"temperature":31.5,"humidity":55.0}'
```

A successful request returns `202 {"status":"accepted"}`. The optional `hardware_status` object must contain integer `bme280`, `ina219`, `bh1750`, and `ds3231` values in the range `0`–`5`.

Notes:

- `POST /api/telemetry` and `GET /health` are public/unauthenticated; other `/api/*` routes still require a Firebase Bearer token.
- The free ngrok URL usually changes each time the tunnel restarts — update the ESP32 firmware/config accordingly.
- Treat the tunnel URL as a public ingress address: add ngrok access controls or an application-level device credential before deploying beyond development.

## Telemetry ingestion contract

MQTT and `POST /api/telemetry` share the same JSON payload:

```json
{
  "device_id": "esp32-01",
  "timestamp": "2026-09-03T12:00:00Z",
  "voltage": 8.5,
  "current": 0.3,
  "lux": 32000,
  "temperature": 33.0,
  "humidity": 60.0,
  "hardware_status": {
    "bme280": 0,
    "ina219": 0,
    "bh1750": 0,
    "ds3231": 0
  }
}
```

- `timestamp` — either `YYYY-MM-DD HH:MM` (treated as UTC) or full ISO-8601/RFC3339 (any timezone).
- `power = voltage × current`, computed before storage.
- `hardware_status` is optional. Codes: `0` OK, `1` initialization failed, `2` device not found, `3` invalid data, `4` read error, `5` device-specific error.
- Firmware must send `lux`, not `light`, and must always include `device_id`.

Example MQTT publish:

```bash
mosquitto_pub -h localhost -p 1883 -t solar/sensors -m '{
  "device_id":"esp32-01",
  "timestamp":"2026-04-16 21:45",
  "voltage":18.5,
  "current":2.0,
  "lux":52000,
  "temperature":34.0,
  "humidity":60.0
}'
```

## Model and diagnostics

```text
latest telemetry → expected-power baseline → operational status
recent telemetry + hardware_status + baseline → diagnostics result
```

The baseline model (`model/baseline_models/`) predicts expected daylight power from lux, temperature, humidity, and UTC time of day. Actual power is compared against it to derive an operational status:

| Condition | `operational_status` |
| --- | --- |
| Lux below 5,000 | `Not evaluated (low light)` |
| Ratio ≥ 0.80 | `Normal` |
| Ratio 0.50 – < 0.80 | `Underperforming` |
| Ratio < 0.50 | `Strong anomaly` |

Diagnostics then independently determine the likely root cause, supporting evidence, a confidence score, severity, and a maintenance recommendation, using the deterministic rules listed under [Repository layout](#repository-layout).

### Try diagnostics manually

```bash
cd backend
source .venv/bin/activate
python
```

```python
from diagnostics import run_diagnostics

history = [
    {"voltage": 18.2, "current": 2.0, "power": 36.4, "lux": 50000, "temperature": 30, "humidity": 55}
    for _ in range(8)
]

result = run_diagnostics(
    latest_telemetry={"voltage": 18.0, "current": 0.1, "power": 1.8, "lux": 52000, "temperature": 31, "humidity": 55},
    historical_telemetry=history,
    ml_prediction={"fault_class": 2, "fault_label": "Fault"},
    hardware_status={"bme280": 0, "ina219": 0, "bh1750": 0, "ds3231": 0},
)

print(result.to_dict())
```

This example should identify `Partial Shading`. Set a hardware-status field to a non-zero value (e.g. `"bme280": 4`) and the primary cause should become `Sensor Failure`.

## API reference

### Public

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness check → `{ "status": "ok" }` |
| `POST /api/telemetry` | Accepts ESP32 telemetry over HTTP(S), same schema as MQTT |

### Dashboard (Firebase Bearer token required)

Send `Authorization: Bearer <FIREBASE_ID_TOKEN>` with every request.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/live?device_id=...` | Latest sensor row (or `null`) |
| `GET /api/history?field=power&start=<iso>&end=<iso>&device_id=...` | Historical values for one of `voltage`, `current`, `power`, `temperature`, `humidity`, `lux`. Defaults to the last 24 hours if `start`/`end` are omitted |
| `GET /api/expected-power?device_id=...` | Actual power, expected power, ratio, and operational status |
| `GET /api/diagnostics?device_id=...` | Root cause, evidence, confidence, severity, and recommendation |
| `GET /api/hardware-status?device_id=...` | Latest BME280, INA219, BH1750, DS3231 status values |
| `GET /api/predictions?device_id=...` | Latest scheduler-derived record (or `null`) |
| `GET /api/alerts?device_id=...` | Recent alerts (may be empty) |
| `GET /api/maintenance?device_id=...` | Maintenance view derived from the current assessment and alerts |

### Administrator (Firebase Bearer token, admin role required)

| Endpoint | Purpose |
| --- | --- |
| `/admin/*` | Customer, panel-array, panel, and panel-health management, backed by Supabase |

## Simulating telemetry

### MQTT simulator

```bash
cd backend
source .venv/bin/activate
python3 scripts/simulate_sensor.py
```

Or non-interactively:

```bash
python3 scripts/simulate_sensor.py --host localhost --port 1883 --topic solar/sensors --interval 2
```

Useful flags:

```bash
python3 scripts/simulate_sensor.py --mode fault                              # only fault samples
python3 scripts/simulate_sensor.py --mode mixed --fault-prob 0.10 --degraded-prob 0.25
python3 scripts/simulate_sensor.py --count 50                                # fixed number of messages
python3 scripts/simulate_sensor.py --override-sensor lux --override-value 7500
python3 scripts/simulate_sensor.py --hardware-status 0 0 0 5                 # add hardware diagnostics
python3 scripts/simulate_sensor.py --mode normal --hardware-status 0 4 0 0   # sensor-failure test
```

The simulator sends realistic, unlabeled telemetry — it does **not** send a scenario label; the backend independently evaluates each reading. Expected results by mode:

| Mode | Expected `operational_status` |
| --- | --- |
| `normal` | `Normal` |
| `degraded` | `Underperforming` |
| `fault` | `Strong anomaly` |
| `night` | `Not evaluated (low light)` |

### Live simulator control page (recommended for demos)

```bash
python3 scripts/simulate_sensor.py --web
```

Open **http://localhost:8765** to switch between normal, degraded, fault, night, and mixed scenarios; adjust the publish interval; set individual sensor values; and add hardware diagnostics — no restart needed. The dashboard polls live readings every five seconds, so allow up to five seconds for a new scenario to appear. The page binds to localhost only by default; use `--web-port 9000` to change it.

### HTTP simulator (via ngrok)

```bash
cd backend
source .venv/bin/activate
python3 scripts/simulate_sensor_ngrok.py \
  --url https://example.ngrok-free.app \
  --count 5 --interval 2
```

Accepts either the ngrok base URL or the full `/api/telemetry` URL, uses only the Python standard library, and does not read, store, or require an ngrok authtoken. Add hardware diagnostics with:

```bash
python3 scripts/simulate_sensor_ngrok.py \
  --url https://example.ngrok-free.app/api/telemetry \
  --hardware-status 0 0 0 0
```

See `--help` for the full flag list.

## Verification

```bash
python -m compileall -q .
pytest
```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Server crashes at startup with "Missing InfluxDB config" | Set `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG` |
| `/api/*` returns 401 | Send a valid Firebase ID token; check `FIREBASE_SERVICE_ACCOUNT_PATH` points to a valid service-account JSON |
| Predictions/expected-power never appear | Confirm recent raw sensor data exists in Influx (publish MQTT or telemetry messages); confirm model assets exist under `backend/ml_models/` (run `scripts/generate_dummy_models.py` if not); reduce `PREDICTION_BATCH_INTERVAL_SECONDS` for faster local iteration |
| `PGRST205: Could not find the table public.customers` | `supabase/schema.sql` hasn't been applied to this Supabase project |
| `new row violates row-level security policy` | Backend is using the anon/publishable key instead of the service-role key |

---

**Reminder:** this system reports an expected-power anomaly baseline and rule-based, explainable diagnostics — not a validated multi-class fault classifier or a maintenance-days forecast.