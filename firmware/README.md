# Firmware Overview

This directory contains the ESP32 firmware used by SolarShield to collect solar-panel and environmental data. Depending on the sketch selected, the ESP32 either stores readings locally, publishes real sensor readings to MQTT, or simulates realistic telemetry for end-to-end testing.

The supported hardware sensors are:

- **INA219** for panel voltage and current
- **BH1750** for light intensity
- **BME280** for temperature and humidity
- **DS3231** for timestamping

## Firmware Files

- [`solar_logger/`](solar_logger/) — Reads the connected sensors and writes timestamped readings to an SD card as `/solar_log.csv`. It is intended for offline data collection.
- [`solar_monitor/`](solar_monitor/) — Reads live sensor data and publishes it to the SolarShield MQTT backend. It uses deep sleep between measurements and includes hardware diagnostics for the BME280, INA219, BH1750, and DS3231.
- [`solar_monitor_test/`](solar_monitor_test/) — Publishes realistic simulated solar data to the same MQTT backend. It needs no physical sensors and is intended for backend, database, ML, and frontend testing.

## Requirements

- [Arduino IDE](https://www.arduino.cc/en/software)
- ESP32 board package for Arduino IDE
- An ESP32 development board
- Wi-Fi access and an MQTT broker for the MQTT sketches
- An SD card and SD-card module for `solar_logger`

Install these libraries through **Arduino IDE → Sketch → Include Library → Manage Libraries**:

- PubSubClient
- ArduinoJson
- RTClib
- BH1750
- Adafruit INA219
- Adafruit BME280 Library
- Adafruit Unified Sensor

`solar_logger` additionally uses the built-in ESP32 `SPI` and `SD` libraries. `solar_monitor_test` uses the built-in `time.h` support for NTP timestamps.

## Setup

1. Install Arduino IDE and the ESP32 board package.
   - In **File → Preferences**, add the Espressif board-manager URL if it is not already configured.
   - In **Tools → Board → Boards Manager**, install **esp32 by Espressif Systems**.
2. Install the required libraries listed above.
3. Open the desired `.ino` sketch and configure its Wi-Fi and MQTT settings.
   - Set `WIFI_SSID` and `WIFI_PASSWORD`.
   - Set `MQTT_SERVER`, `MQTT_PORT`, and, where required, MQTT credentials.
   - Keep `MQTT_TOPIC` aligned with the backend topic, normally `solar/sensors`.
   - For `solar_monitor_test`, set `DEVICE_ID` to the device configured in the backend/frontend.
4. Connect the ESP32, then select the correct board and COM/serial port in **Tools**.
5. Upload the desired firmware and open the Serial Monitor at **115200 baud** to verify sensor, Wi-Fi, MQTT, and diagnostics output.

## Usage

### `solar_logger`

Use this sketch when collecting a local sensor dataset without requiring Wi-Fi, MQTT, InfluxDB, or the backend. It reads the sensors, appends a CSV row to the SD card, then enters deep sleep for ten minutes.

### `solar_monitor`

Use this sketch on the real deployed panel. It reads the connected sensors, publishes telemetry to MQTT, prints diagnostic output, and enters deep sleep for ten minutes. The hardware-status object reports the runtime health of the four supported sensors.

### `solar_monitor_test`

Use this sketch for demonstrations and integration testing when physical sensors or a solar panel are unavailable. It generates gradual daylight cycles, normal operating values, and occasional abnormal conditions, then publishes a sample every five seconds.

## Project Structure

```text
firmware/
├── README.md
├── solar_logger/
│   └── solar_logger.ino
├── solar_monitor/
│   └── solar_monitor.ino
└── solar_monitor_test/
    ├── README.md
    └── solar_monitor_test.ino
```

## Notes

- `solar_monitor` and `solar_monitor_test` use the same core MQTT telemetry contract and topic, so the backend does not need to change when switching between real and simulated data sources.
- Keep the device ID, MQTT topic, and broker settings consistent with the backend configuration.
- Configure credentials locally before uploading. Do not commit Wi-Fi passwords, broker credentials, or other secrets to version control.
