# ESP32 MQTT Test Telemetry Sketch

`solar_monitor_test.ino` publishes continuously changing simulated solar
telemetry to the same MQTT topic used by the real monitor. It requires no
physical sensors and is useful for exercising MQTT ingestion, InfluxDB,
expected-power status, diagnostics, and the frontend.

## Configure

Set these values at the top of the sketch before uploading:

- `WIFI_SSID` and `WIFI_PASSWORD`
- `MQTT_SERVER`, `MQTT_PORT`, `MQTT_USER`, and `MQTT_PASSWORD` as needed
- `MQTT_TOPIC`, normally `solar/sensors`
- `DEVICE_ID`, normally `esp32-01`

Do not use `localhost` for `MQTT_SERVER`; on an ESP32 it means the ESP32 itself.
Use the broker machine's LAN IP address or DNS name instead.

The sketch uses NTP and publishes UTC timestamps. `SIMULATION_UTC_OFFSET_SEC`
only controls the simulated daylight curve.

## Libraries

Install these libraries with Arduino Library Manager:

- PubSubClient
- ArduinoJson

Select an ESP32 board, upload the sketch, then open Serial Monitor at 115200
baud to inspect each MQTT packet.

## Payload

Every packet includes the normal telemetry fields and an explicit all-OK
hardware status object because this sketch has no physical sensors to read:

```json
{
  "device_id": "esp32-01",
  "timestamp": "2026-09-03T12:34:56Z",
  "voltage": 8.5,
  "current": 0.3,
  "lux": 32000,
  "temperature": 33.4,
  "humidity": 56.2,
  "hardware_status": {
    "bme280": 0,
    "ina219": 0,
    "bh1750": 0,
    "ds3231": 0
  }
}
```

The backend calculates power as voltage × current and independently determines
expected-power status and diagnostics. This sketch does not publish a scenario,
model result, or fault label.
