# SolarShield ESP32 Firmware

This directory contains ESP32 sketches for collecting and publishing solar
telemetry. The real monitor includes hardware diagnostics for the BME280,
INA219, BH1750, and DS3231.

## Sketches

| Sketch | Use |
| --- | --- |
| [`solar_logger/`](solar_logger/) | Logs sensor data to an SD card for offline collection. |
| [`solar_monitor/`](solar_monitor/) | Reads connected hardware and sends telemetry to MQTT or FastAPI HTTPS. |
| [`solar_monitor_test/`](solar_monitor_test/) | Sends simulated MQTT telemetry for integration testing without sensor hardware. |

## Hardware

- INA219: panel voltage and current
- BH1750: light intensity
- BME280: temperature and humidity
- DS3231: timestamp source

The real monitor uses I2C bus 0 on GPIO 21/22 for DS3231, BH1750, and INA219,
and I2C bus 1 on GPIO 16/17 for BME280.

## Arduino requirements

- Arduino IDE with the Espressif ESP32 board package
- ESP32 development board
- Wi-Fi and an MQTT broker for MQTT publishing
- SD card/module for `solar_logger`

Install these libraries through Arduino Library Manager:

- PubSubClient
- ArduinoJson
- RTClib
- BH1750
- Adafruit INA219
- Adafruit BME280 Library
- Adafruit Unified Sensor

`solar_logger` also uses built-in ESP32 `SPI` and `SD` support. The test sketch
uses built-in NTP/time support.

## Setup

1. Install Arduino IDE and the ESP32 board package.
2. Open the target `.ino` file.
3. Configure Wi-Fi, `DEVICE_ID`, and the selected transport endpoint/topic.
4. Select the ESP32 board and serial port.
5. Upload the sketch and open Serial Monitor at 115200 baud.

Keep `DEVICE_ID` and MQTT topic aligned with backend configuration. The normal
MQTT topic is `solar/sensors`.

## Hardware diagnostics

`solar_monitor` sends this object in each telemetry packet:

```json
"hardware_status": {
  "bme280": 0,
  "ina219": 0,
  "bh1750": 0,
  "ds3231": 0
}
```

| Code | Meaning |
| --- | --- |
| 0 | OK |
| 1 | Initialization failed |
| 2 | Device not found |
| 3 | Invalid data |
| 4 | Read error |
| 5 | Device-specific error |

The monitor continues publishing when one sensor fails so the backend can show
the hardware failure instead of losing all remaining telemetry.

## Transport options

`solar_monitor` can send either MQTT or direct HTTPS telemetry. Configure
`USE_NGROK_HTTPS` and `NGROK_TELEMETRY_URL` in the sketch for the HTTPS path.
The URL must end in `/api/telemetry` and may change each time a free ngrok
tunnel restarts.

The development HTTPS implementation uses `WiFiClientSecure::setInsecure()`.
Traffic is encrypted, but server certificates are not verified. Use a trusted
CA certificate with `setCACert()` before production deployment.

## Notes

- `solar_monitor` and `solar_monitor_test` use the same core telemetry fields,
  MQTT topic, and hardware-status schema.
- Do not commit Wi-Fi passwords, broker credentials, or tunnel URLs.
- Use `solar_monitor_test` or the backend simulator for dashboard demos when
  physical hardware is unavailable.
