# SolarShield Backend (FastAPI)

ML-driven predictive maintenance and efficiency analysis backend for solar panel monitoring.

## What this backend does

- **Ingests live sensor readings** via MQTT and stores them in **InfluxDB 2.x**
- **Serves REST APIs** for live values, history charts, predictions, alerts, and maintenance guidance
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

Start an MQTT broker (example with Mosquitto):

```bash
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto:2
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

## Data ingestion contract (MQTT payload)

The MQTT subscriber expects JSON payloads on `MQTT_TOPIC` with fields:

- `device_id` (string)
- `timestamp` (string): either `YYYY-MM-DD HH:MM` (treated as UTC) or ISO-8601/RFC3339
- `voltage` (number)
- `current` (number)
- `lux` (number)
- `temperature` (number)
- `humidity` (number)

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

