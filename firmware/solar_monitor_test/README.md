# ESP32 MQTT telemetry simulator

`solar_monitor_test.ino` publishes a realistic, continuously changing solar-panel
sample every five seconds. It has no sensor hardware dependency and is intended to
exercise the MQTT ingestion, dashboard, and prediction flow.

## Configure

Before uploading, edit the configuration block at the top of the sketch:

- `WIFI_SSID` and `WIFI_PASSWORD`
- `MQTT_SERVER`: the LAN IP/DNS name of the machine running the MQTT broker. Do
  not use `localhost`, because on an ESP32 that refers to the ESP32 itself.
- `MQTT_PORT`, `MQTT_USER`, and `MQTT_PASSWORD` if your broker requires them
- `MQTT_TOPIC`: must equal backend `MQTT_TOPIC` (default: `solar/sensors`)
- `DEVICE_ID`: must equal the device selected by the backend/frontend (default:
  `esp32-01`)

The sketch uses NTP and sends current UTC timestamps, so samples fall within the
backend's recent-data query window. `SIMULATION_UTC_OFFSET_SEC` controls only the
fake daylight curve; it is set to India Standard Time (`19800`).

## Arduino libraries

Install these through Arduino IDE Library Manager (or `arduino-cli lib install`):

- PubSubClient
- ArduinoJson

Select an ESP32 board and upload `solar_monitor_test.ino`. The Serial Monitor at
115200 baud prints each JSON message. A successful sample has this shape:

```json
{
  "device_id": "esp32-01",
  "timestamp": "2026-07-21T12:34:56Z",
  "voltage": 13.8,
  "current": 2.1,
  "lux": 48000,
  "temperature": 33.4,
  "humidity": 56.2
}
```

Start the backend with the same MQTT host/topic. Its subscriber converts the
sample to a `sensor_data` point in InfluxDB and calculates power as voltage ×
current.
