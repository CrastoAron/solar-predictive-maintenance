# SolarShield Backend (FastAPI)

ML-driven predictive maintenance and efficiency analysis backend for solar panel monitoring.

## What this backend does

- **Ingests live sensor readings** via MQTT and stores them in **InfluxDB 2.x**
- **Captures optional hardware diagnostics** from MQTT payloads and stores them alongside sensor readings
- **Serves REST APIs** for live values, history charts, predictions, alerts, hardware diagnostics, and maintenance guidance
- **Runs a background scheduler** that periodically:
  - pulls last ~30 minutes of sensor data from InfluxDB
  - computes features
  - runs ML models to produce predictions
  - writes predictions + alerts back to InfluxDB

## Tech stack

- **API**: FastAPI + Uvicorn (`main.py`)
- **Auth**: Firebase Admin (Bearer ID token required for `/api/*`)
- **Storage**: InfluxDB 2.x
- **Ingestion**: MQTT (Paho client)
- **Scheduler**: APScheduler (AsyncIO scheduler)
- **ML runtime**: `joblib`-loaded scikit-learn artifacts (dummy or real)

## Repository layout (backend)

- `main.py`: FastAPI app + startup/shutdown lifecycle (starts MQTT + scheduler)
- `config.py`: environment variables and defaults
- `dependencies.py`: auth dependency (`get_current_user`)
- `routers/`: API routes
- `services/`:
  - `mqtt_client.py`: subscribes to MQTT topic and writes sensor points to InfluxDB
  - `influx_client.py`: read/write operations for raw sensor data, predictions, alerts
  - `feature_eng.py`: feature computation from recent sensor window
  - `ml_runner.py`: loads ML assets and produces predictions
  - `scheduler.py`: periodic batch prediction job
  - `firebase_admin.py`: Firebase token verification
- `scripts/generate_dummy_models.py`: generates test ML assets for local development
- `scripts/simulate_sensor.py`: publishes simulated sensor readings to MQTT (for end-to-end testing)
- `ml_models/`: ML assets (created locally; not required to be committed)

## Requirements

- Python 3.10+ recommended
- InfluxDB 2.x reachable from this service
- MQTT broker reachable from this service (Mosquitto etc.)
- Firebase service account JSON (for authenticated endpoints)

Install Python dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration (environment variables)

### Supabase admin configuration

The admin customer and panel editor persists to Supabase; it is not a frontend-only store.

1. In Supabase, open the target project and choose **SQL Editor**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repository, copy its contents,
   and run it in the SQL Editor. It creates `customers`, `panel_arrays`, and `panels`, plus
   their relationships, indexes, and RLS configuration.
3. In **Project Settings → API**, copy the project URL and the **service_role** secret key.
   Do not use the `anon`/publishable key for the backend admin store.
4. Set these values in `backend/.env` and restart the backend process:

   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret
   ```

`SUPABASE_SERVICE_ROLE_KEY` is server-only—never expose it through `NEXT_PUBLIC_*` values,
place it in frontend code, or commit it to the repository. The service-role key bypasses the
RLS policies used to protect browser clients.

Troubleshooting:

- `PGRST205: Could not find the table public.customers`: step 2 was not applied to this
  Supabase project. Run `supabase/schema.sql` in its SQL Editor.
- `new row violates row-level security policy`: the backend is using an anon/publishable key.
  Replace `SUPABASE_SERVICE_ROLE_KEY` with the actual **service_role** key and restart the
  backend. Do not copy the anon key into both variables.
- The backend deliberately returns database errors when Supabase is configured but broken;
  it does not write temporary in-memory customer or panel records in that case.

The backend uses `python-dotenv` to load environment variables. You can export them in your shell or put them in `backend/.env`.

### InfluxDB (required)

- `INFLUX_URL` (required): e.g. `http://localhost:8086`
- `INFLUX_TOKEN` (required)
- `INFLUX_ORG` (default: `solar_org`)
- `INFLUX_BUCKET_RAW` (default: `solar_raw`)
- `INFLUX_BUCKET_PREDICTIONS` (default: `solar_predictions`)
- `INFLUX_BUCKET_ALERTS` (default: `solar_alerts`)
- `INFLUX_LATEST_LOOKBACK` (default: `30d`)

### MQTT (required)

- `MQTT_HOST` (default: `localhost`)
- `MQTT_PORT` (default: `1883`)
- `MQTT_TOPIC` (default: `solar/sensors`)
- `MQTT_QOS` (default: `1`)

### Firebase auth (required for `/api/*`)

- `FIREBASE_SERVICE_ACCOUNT_PATH` (default: `serviceAccountKey.json`)
- `FIREBASE_PROJECT_ID` (optional): if set, the token audience is validated

### Scheduler + alerts

- `PREDICTION_BATCH_INTERVAL_SECONDS` (default: `300`)
- `DEFAULT_DEVICE_ID` (default: `esp32-01`)
- `FAULT_ALERT_MIN_CLASS` (default: `1`)
- `EFFICIENCY_ALERT_MAX_SCORE` (default: `60`)

### ML assets paths

Defaults (relative to `backend/`):

- `RF_MODEL_PATH` → `backend/ml_models/rf_classifier.pkl`
- `XGB_MODEL_PATH` → `backend/ml_models/xgb_regressor.pkl`
- `FEATURES_JSON_PATH` → `backend/ml_models/features.json`

## Running locally

### 1) Start dependencies

# 1. Clean up conflicting networks or containers
```bash
docker stop mosquitto 2>/dev/null || true
docker rm mosquitto 2>/dev/null || true
docker network rm my_mqtt_net 2>/dev/null || true
```
# 2. Build the exact matching bridge subnet mask
```bash
docker network create --subnet=192.168.137.0/24 my_mqtt_net
```

# 3. Spin up the container with volume mapping and static address allocation
```bash
docker run -d \
  --name mosquitto \
  --network my_mqtt_net \
  --ip 192.168.137.50 \
  -p 1883:1883 \
  -v \$(pwd)/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  eclipse-mosquitto:2
```

Start InfluxDB 2.x (example):

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

Create buckets (if you didn’t already) in the Influx UI:

- `solar_raw`
- `solar_predictions`
- `solar_alerts`

### 2) Export env vars

If you have `backend/.env` containing `export ...` lines, you can load it with:

```bash
cd backend
source .env
```

At minimum, ensure you set `INFLUX_URL`, `INFLUX_TOKEN`, and `INFLUX_ORG`.

### 3) (Optional) Generate dummy ML models for testing

If you don’t have real trained models yet, generate dummy assets:

```bash
cd backend
source .venv/bin/activate
python3 scripts/generate_dummy_models.py
```

This creates:

- `backend/ml_models/features.json`
- `backend/ml_models/rf_classifier.pkl`
- `backend/ml_models/xgb_regressor.pkl`

### 4) Start the API server

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check (no auth):

```bash
curl http://localhost:8000/health
```

### 5) Simulate sensor readings (end-to-end testing)

If you don’t have ESP32 hardware connected yet, you can publish simulated sensor readings to MQTT.
The backend will ingest them into InfluxDB, the frontend will update live metrics, and the scheduler can generate predictions/alerts.

Run interactively with prompts:

```bash
cd backend
source .venv/bin/activate
python3 scripts/simulate_sensor.py
```

Run (mixed normal/degraded/fault samples):

```bash
cd backend
source .venv/bin/activate
python3 scripts/simulate_sensor.py --host localhost --port 1883 --topic solar/sensors --interval 2
```

Force only fault samples:

```bash
python3 scripts/simulate_sensor.py --mode fault
```

Tune fault/degraded frequency (when `--mode mixed`):

```bash
python3 scripts/simulate_sensor.py --mode mixed --fault-prob 0.10 --degraded-prob 0.25
```

Send a fixed number of messages then exit:

```bash
python3 scripts/simulate_sensor.py --count 50
```

Override a specific sensor value for every payload:

```bash
python3 scripts/simulate_sensor.py --override-sensor lux --override-value 7500
```

Include optional hardware diagnostics in the payload:

```bash
python3 scripts/simulate_sensor.py --hardware-status 0 0 0 5
```

## Data ingestion contract (MQTT payload)

The MQTT subscriber expects JSON payloads on `MQTT_TOPIC` with fields:

- `device_id` (string)
- `timestamp` (string): either `YYYY-MM-DD HH:MM` (treated as UTC) or ISO-8601/RFC3339
- `voltage` (number)
- `current` (number)
- `lux` (number)
- `temperature` (number)
- `humidity` (number)
- `hardware_status` (optional object): numeric status codes for diagnostics
  - `bme280`, `ina219`, `bh1750`, `ds3231` (each integer 0-5)

> Important: firmware must send `lux` not `light`, and must include `device_id`.

Power is computed as `power = voltage * current` before writing to InfluxDB.

Example publish (Mosquitto):

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

## Background jobs

On app startup, `main.py` starts:

- **MQTTSubscriber**: connects to the broker and subscribes to `MQTT_TOPIC`
- **PredictionScheduler**: runs every `PREDICTION_BATCH_INTERVAL_SECONDS`

The scheduler will **skip** prediction runs if:

- ML assets are not available (`ml_runner.is_ready() == false`)
- no recent raw sensor data exists in the last ~30 minutes

## API endpoints

### Public

- `GET /health` → `{ "status": "ok" }`

### Authenticated (Firebase Bearer token required)

All endpoints below require:

`Authorization: Bearer <FIREBASE_ID_TOKEN>`

- `GET /api/live?device_id=esp32-01`
  - returns latest sensor row from Influx (or `null` if none)
- `GET /api/history?field=power&start=<iso>&end=<iso>&device_id=...`
  - if `start`/`end` omitted, defaults to last 24 hours
  - `field` must be one of: `voltage`, `current`, `power`, `temperature`, `humidity`, `lux`
- `GET /api/predictions?device_id=...`
  - returns latest prediction (or `null` if none)
- `GET /api/alerts?device_id=...`
  - returns latest alerts list (may be empty)
- `GET /api/hardware-status?device_id=...`
  - returns the latest device diagnostics snapshot with `bme280`, `ina219`, `bh1750`, and `ds3231`
- `GET /api/maintenance?device_id=...`
  - derived view based on latest prediction + efficiency trend

## Troubleshooting

- **Server crashes at startup with “Missing InfluxDB config”**
  - Set `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`
- **`/api/*` returns 401**
  - You must be logged in on the frontend and send a Firebase ID token
  - Ensure `FIREBASE_SERVICE_ACCOUNT_PATH` points to a valid service account JSON
- **Predictions never appear**
  - Ensure you have recent raw sensor data in Influx (publish MQTT messages)
  - Ensure ML assets exist (`backend/ml_models/*`) or run `scripts/generate_dummy_models.py`
  - Reduce `PREDICTION_BATCH_INTERVAL_SECONDS` for faster local iteration

## Diagnostics module

`backend/diagnostics/` is an independent, deterministic root-cause analysis module. It does not alter MQTT ingestion, InfluxDB storage, the ML pipeline, API routes, or the frontend. It consumes telemetry, historical telemetry, an optional ML prediction, and ESP32 hardware-status values, then returns an explainable diagnostic result.

The module includes rule-based detectors for:

- Sensor Failure
- Partial Shading
- Dust Accumulation
- Panel Degradation
- Possible Panel Damage
- Loose Wiring

The ML prediction supplies the overall health label when available; diagnostics rules independently determine the likely cause, evidence, confidence score, severity, and maintenance recommendation.

### Diagnostics requirements

No additional packages are needed beyond `requirements.txt`. The diagnostics package uses Python standard-library dataclasses, enums, and statistics utilities.

### Test diagnostics manually

From the `backend/` directory, activate the virtual environment and open Python:

```bash
source .venv/bin/activate
python
```

```python
from diagnostics import run_diagnostics

history = [
    {
        "voltage": 18.2,
        "current": 2.0,
        "power": 36.4,
        "lux": 50000,
        "temperature": 30,
        "humidity": 55,
    }
    for _ in range(8)
]

result = run_diagnostics(
    latest_telemetry={
        "voltage": 18.0,
        "current": 0.1,
        "power": 1.8,
        "lux": 52000,
        "temperature": 31,
        "humidity": 55,
    },
    historical_telemetry=history,
    ml_prediction={"fault_class": 2, "fault_label": "Fault"},
    hardware_status={"bme280": 0, "ina219": 0, "bh1750": 0, "ds3231": 0},
)

print(result.to_dict())
```

The example should identify `Partial Shading` with evidence and a confidence score. To test sensor diagnostics, set a hardware status to a non-zero value, for example `"bme280": 4`; the primary cause should become `Sensor Failure`.
