# SolarShield Backend

The backend is a FastAPI service that receives solar telemetry, writes it to
InfluxDB, derives expected-power and explainable diagnostic assessments, and
serves the dashboard and administrator APIs.

## Responsibilities

- Ingest telemetry through MQTT on `MQTT_TOPIC` or unauthenticated HTTPS at
  `POST /api/telemetry`.
- Store sensor readings and optional ESP32 `hardware_status` values in InfluxDB.
- Calculate expected daylight power and operational status.
- Run deterministic diagnostics from telemetry, history, and hardware status.
- Run a scheduler that records derived status and alerts for existing dashboard
  prediction, maintenance, and alert views.
- Provide Firebase-protected dashboard APIs and Firebase-admin-protected
  customer/panel management APIs backed by Supabase.

## Model and diagnostics

The active runtime path is:

```text
latest telemetry → expected-power baseline → operational status
recent telemetry + hardware_status + baseline → diagnostics result
```

The baseline model is stored in `model/baseline_models/`. It predicts expected
daylight power from lux, temperature, humidity, and UTC time of day.

| Condition | `operational_status` |
| --- | --- |
| Lux below 5,000 | `Not evaluated (low light)` |
| Ratio at least 0.80 | `Normal` |
| Ratio from 0.50 to less than 0.80 | `Underperforming` |
| Ratio below 0.50 | `Strong anomaly` |

Diagnostics are rule-based and explainable. They can report Sensor Failure,
Partial Shading, Dust Accumulation, Panel Degradation, Possible Panel Damage,
Loose Wiring, or Low-output anomaly. The final option is intentional: it is
used when a deviation exists but the telemetry cannot prove a physical cause.

## Requirements

- Python 3.10 or later
- InfluxDB 2.x
- MQTT broker such as Mosquitto for MQTT ingestion
- Firebase service-account JSON for authenticated APIs
- Supabase URL and service-role key for administrator data management

Install dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Create `backend/.env` from [`.env.example`](.env.example), then set the
required values.

| Group | Important variables |
| --- | --- |
| InfluxDB | `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, bucket names |
| MQTT | `MQTT_HOST`, `MQTT_PORT`, `MQTT_TOPIC`, `MQTT_QOS` |
| Device defaults | `DEFAULT_DEVICE_ID`, `ESP32_NAIVE_TIMESTAMP_UTC_OFFSET_MINUTES` |
| Firebase | `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_PROJECT_ID` |
| Supabase admin store | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Scheduling | `PREDICTION_BATCH_INTERVAL_SECONDS`, alert thresholds |
| Baseline | `EXPECTED_POWER_MODEL_PATH`, `EXPECTED_POWER_FEATURES_PATH`, `EXPECTED_POWER_DAYLIGHT_LUX_MIN` |

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or commit it to the
repository. Apply [`supabase/schema.sql`](supabase/schema.sql) in the Supabase
SQL editor before using the admin APIs.

## Run locally

Start InfluxDB and Mosquitto, configure `.env`, then run:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify the public health endpoint:

```bash
curl http://localhost:8000/health
```

The repository root [`arch_setup.sh`](../arch_setup.sh) can automate the local
Docker services, application processes, and ngrok tunnel on Arch Linux.

## Telemetry contract

Both MQTT and `POST /api/telemetry` use the same payload fields:

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

`power` is calculated as voltage × current before storage. Hardware status
codes are: `0` OK, `1` initialization failed, `2` device not found, `3` invalid
data, `4` read error, and `5` device-specific error.

## APIs

`GET /health` and `POST /api/telemetry` are public. Dashboard APIs require a
Firebase Bearer token. Administrator routes require an authenticated Firebase
user with the admin role.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/live` | Latest sensor row. |
| `GET /api/history` | Historical voltage, current, power, lux, temperature, or humidity values. |
| `GET /api/expected-power` | Actual power, expected power, ratio, and operational status. |
| `GET /api/diagnostics` | Explainable health, root cause, evidence, confidence, and recommendation. |
| `GET /api/hardware-status` | Latest BME280, INA219, BH1750, and DS3231 status values. |
| `GET /api/predictions` | Latest scheduler-derived compatibility record. |
| `GET /api/alerts` | Recent alerts. |
| `GET /api/maintenance` | Maintenance view derived from current assessment and alerts. |
| `/admin/*` | Customer, panel-array, panel, and panel-health management APIs. |

## Simulating telemetry

Publish realistic MQTT telemetry using the baseline-aware simulator:

```bash
cd backend
source .venv/bin/activate
python scripts/simulate_sensor.py --web
```

Open `http://localhost:8765` to change scenario, values, and hardware status.
The simulator does not send a scenario label; it sends normal telemetry and the
backend independently evaluates it.

| Mode | Expected dashboard result |
| --- | --- |
| `normal` | Normal |
| `degraded` | Underperforming |
| `fault` | Strong anomaly |
| `night` | Not evaluated (low light) |

For a sensor failure test:

```bash
python scripts/simulate_sensor.py --mode normal --hardware-status 0 4 0 0
```

To post HTTP test telemetry through an ngrok tunnel, use
`scripts/simulate_sensor_ngrok.py`; see its `--help` output.

## Verification

```bash
python -m compileall -q .
pytest
```

## Important limitation

The field dataset has no verified physical-fault labels. Do not describe this
system as a validated multi-class fault classifier or maintenance-days forecast.
It is an expected-power anomaly baseline plus evidence-based diagnostics.
