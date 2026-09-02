/*
 * Solar Panel Monitor - ESP32 Night Sleep + ngrok HTTPS
 *
 * Hardware:
 *   I2C Bus 0 (GPIO 21/22): DS3231 RTC, BH1750, INA219
 *   I2C Bus 1 (GPIO 16/17): BME280
 *
 * Night sleep check interval: 10 minutes
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <RTClib.h>
#include <BH1750.h>
#include <Adafruit_INA219.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>
#include <time.h>


// USER CONFIGURATION
#define WIFI_SSID       "Batman"
#define WIFI_PASSWORD   "12345679"
#define DEVICE_ID       "esp32-01"

#define USE_NGROK_HTTPS true
// Copy the current HTTPS forwarding URL printed by `ngrok http 8000` and add
// `/api/telemetry`. Do not put an ngrok authtoken in this sketch.
#define NGROK_TELEMETRY_URL "https://chain-quarters-thread.ngrok-free.dev/api/telemetry"


// TIMING
#define NIGHT_SLEEP_MINUTES 10ULL
#define uS_TO_MIN       (60ULL * 1000000ULL)
#define NIGHT_SLEEP_DURATION (NIGHT_SLEEP_MINUTES * uS_TO_MIN)
#define DAYLIGHT_THRESHOLD_LUX 5.0f
#define NIGHT_START_HOUR 22
#define NIGHT_END_HOUR 6
#define PUBLISH_INTERVAL_MS (1UL * 60UL * 100UL)
#define SENSOR_CHECK_INTERVAL_MS 10000UL
#define BME280_READ_RETRIES 3
#define BME280_INIT_RETRIES 3
#define SENSOR_READ_RETRIES 3
#define SENSOR_SETTLE_DELAY_MS 100UL
#define BME280_STARTUP_DELAY_MS 500UL
#define SENSOR_BOOT_WAIT_MS 2000UL

#define NTP_SERVER      "pool.ntp.org"
#define UTC_OFFSET_SEC  19800
#define DAYLIGHT_OFFSET_SEC 0


// I2C BUS DEFINITIONS
#define I2C0_SDA 21
#define I2C0_SCL 22

#define I2C1_SDA 16
#define I2C1_SCL 17

TwoWire I2C_0 = TwoWire(0);   // RTC, BH1750, INA219
TwoWire I2C_1 = TwoWire(1);   // BME280

// SENSOR & PERIPHERAL OBJECTS
RTC_DS3231        rtc;
BH1750            lightMeter;
Adafruit_INA219   ina219;
Adafruit_BME280   bme;

// HARDWARE DIAGNOSTICS
// These numeric values are sent in every telemetry payload.
enum HardwareStatusCode : uint8_t {
  STATUS_OK = 0,
  STATUS_INITIALIZATION_FAILED = 1,
  STATUS_DEVICE_NOT_FOUND = 2,
  STATUS_INVALID_DATA = 3,
  STATUS_READ_ERROR = 4,
  STATUS_DEVICE_SPECIFIC_ERROR = 5
};

struct HardwareStatus {
  uint8_t bme280;
  uint8_t ina219;
  uint8_t bh1750;
  uint8_t ds3231;
};

HardwareStatus hardwareStatus = {
  STATUS_INITIALIZATION_FAILED,
  STATUS_INITIALIZATION_FAILED,
  STATUS_INITIALIZATION_FAILED,
  STATUS_INITIALIZATION_FAILED
};

bool bme280Ready = false;
bool ina219Ready = false;
bool bh1750Ready = false;
bool ds3231Ready = false;
bool bme280ReadThisCycle = false;
bool ina219ReadThisCycle = false;
bool bh1750ReadThisCycle = false;
bool ds3231ReadThisCycle = false;
uint8_t bme280Address = 0;


// SENSOR DATA STRUCT
struct SensorData {
  char    timestamp[17];   // "YYYY-MM-DD HH:MM"
  float   voltage;
  float   current;
  float   temperature;
  float   humidity;
  float   light;
  bool    valid;
};


// FORWARD DECLARATIONS
bool    initSensors();
bool    readSensors(SensorData &data);
bool    connectWiFi();
bool    publishData(const SensorData &data);
bool    publishDataToNgrok(const String &payload);
bool    syncRtcFromNtp();
bool    isNightTime(const DateTime &time);
bool    shouldSleepAtNight(const SensorData &data);
void    goToNightSleep();
String  buildJSON(const SensorData &data);
void    updateHardwareStatus();
void    validateSensorReadings(SensorData &data);
void    appendHardwareStatus(JsonDocument &doc);
void    printHardwareStatus();
void    setHardwareStatus(const char *device, uint8_t &status, uint8_t nextStatus);
bool    isValidRtcTime(const DateTime &time);
bool    isI2CDeviceResponsive(TwoWire &bus, uint8_t address);
bool    initializeBme280();
bool    readBme280(float &temperature, float &humidity);
bool    initializeIna219();
bool    readIna219(float &voltage, float &current);
bool    initializeBh1750();
bool    readBh1750(float &light);
bool    readRtcTimestamp(char *timestamp, size_t timestampSize);
unsigned long lastPublishTime = 0;
unsigned long lastSensorCheckTime = 0;


// SETUP
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println(F("\n[Solar Monitor] Waking up..."));

  // Initialise I2C buses
  I2C_0.begin(I2C0_SDA, I2C0_SCL, 100000);
  I2C_1.begin(I2C1_SDA, I2C1_SCL, 100000);
  I2C_0.setClock(100000);
  I2C_1.setClock(100000);
  delay(500);

  Serial.printf("[Startup] Waiting %lu ms for sensors to initialize after reset...\n",
                (unsigned long)SENSOR_BOOT_WAIT_MS);
  delay(SENSOR_BOOT_WAIT_MS);

  SensorData data;

  initSensors();

  if (!connectWiFi()) {
    Serial.println(F("[ERROR] WiFi failed. Will retry."));
    return;
  }

  if (ds3231Ready && (rtc.lostPower() || !isValidRtcTime(rtc.now()))) {
    Serial.println(F("[Time] RTC time invalid or lost; fetching from NTP on boot."));
    syncRtcFromNtp();
  }

  // A failed sensor is diagnostic information, not a reason to prevent the
  // remaining healthy sensors from publishing telemetry.
  readSensors(data);

  if (shouldSleepAtNight(data)) {
    Serial.println(F("[Night] Night schedule detected. Entering deep sleep."));
    shutdownPeripherals();
    goToNightSleep();
    return;
  }

  if (publishData(data)) {
    Serial.println(F("[OK] Data published."));
  } else {
    Serial.println(F("[ERROR] Publish failed."));
  }

  lastPublishTime = millis();
  lastSensorCheckTime = millis();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  if (ds3231Ready && (rtc.lostPower() || !isValidRtcTime(rtc.now()))) {
    syncRtcFromNtp();
  }

  if (now - lastSensorCheckTime < SENSOR_CHECK_INTERVAL_MS) {
    return;
  }
  lastSensorCheckTime = now;

  SensorData data;
  readSensors(data);

  if (shouldSleepAtNight(data)) {
    Serial.println(F("[Night] Night schedule detected. Entering deep sleep."));
    shutdownPeripherals();
    goToNightSleep();
    return;
  }

  if (now - lastPublishTime >= PUBLISH_INTERVAL_MS) {
    if (publishData(data)) {
      Serial.println(F("[OK] Data published."));
    } else {
      Serial.println(F("[ERROR] Publish failed."));
    }
    lastPublishTime = now;
  }
}


// SENSOR INIT
bool initSensors() {
  Serial.println(F("[Diagnostics] Initializing hardware..."));

  // RTC
  if (!rtc.begin(&I2C_0)) {
    Serial.println(F("[ERROR] DS3231 not found"));
    setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_DEVICE_NOT_FOUND);
  } else {
    ds3231Ready = true;
    if (rtc.lostPower()) {
      Serial.println(F("[WARN] DS3231 lost power — time may be wrong"));
      setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_DEVICE_SPECIFIC_ERROR);
    } else {
      setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_OK);
    }
  }

  // INA219 (I2C Bus 0, default address 0x40)
  ina219Ready = initializeIna219();

  // BH1750 (I2C Bus 0)
  bh1750Ready = initializeBh1750();

  // BME280 (I2C Bus 1; try both supported addresses)
  bme280Ready = initializeBme280();

  printHardwareStatus();
  return bme280Ready || ina219Ready || bh1750Ready || ds3231Ready;
}

bool initializeBme280() {
  bme280Ready = false;
  bme280Address = 0;

  for (uint8_t attempt = 0; attempt < BME280_INIT_RETRIES; ++attempt) {
    delay(BME280_STARTUP_DELAY_MS);
    if (bme.begin(0x77, &I2C_1)) {
      bme280Address = 0x77;
    } else if (bme.begin(0x76, &I2C_1)) {
      bme280Address = 0x76;
    }

    if (bme280Address != 0) {
      bme280Ready = true;
      delay(300);
      Serial.println(F("[OK] BME280 initialized"));
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_OK);
      return true;
    }

    Serial.printf("[WARN] BME280 initialization failed (attempt %u/%u)\n",
      attempt + 1, BME280_INIT_RETRIES);
    delay(100);
  }

  Serial.println(F("[ERROR] BME280 not found"));
  setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_DEVICE_NOT_FOUND);
  return false;
}

bool initializeIna219() {
  ina219Ready = false;
  for (uint8_t attempt = 0; attempt < SENSOR_READ_RETRIES; ++attempt) {
    if (ina219.begin(&I2C_0)) {
      ina219Ready = true;
      Serial.println(F("[OK] INA219 initialized"));
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_OK);
      return true;
    }
    delay(SENSOR_SETTLE_DELAY_MS);
  }

  Serial.println(F("[ERROR] INA219 not found"));
  setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_DEVICE_NOT_FOUND);
  return false;
}

bool initializeBh1750() {
  bh1750Ready = false;
  for (uint8_t attempt = 0; attempt < SENSOR_READ_RETRIES; ++attempt) {
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2C_0)) {
      bh1750Ready = true;
      Serial.println(F("[OK] BH1750 initialized"));
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_OK);
      return true;
    }
    delay(SENSOR_SETTLE_DELAY_MS);
  }

  Serial.println(F("[ERROR] BH1750 not found"));
  setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_DEVICE_NOT_FOUND);
  return false;
}

bool readBme280(float &temperature, float &humidity) {
  for (uint8_t attempt = 0; attempt < BME280_READ_RETRIES; ++attempt) {
    if (bme280Address == 0 || !isI2CDeviceResponsive(I2C_1, bme280Address)) {
      Serial.println(F("[ERROR] BME280 I2C communication failed"));
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_READ_ERROR);
    } else {
      temperature = bme.readTemperature();
      humidity = bme.readHumidity();

      if (isfinite(temperature) && isfinite(humidity) &&
          temperature >= -40.0f && temperature <= 85.0f &&
          humidity >= 0.0f && humidity <= 100.0f) {
        return true;
      }

      Serial.println(F("[ERROR] BME280 returned invalid data"));
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_INVALID_DATA);
    }

    if (attempt + 1 < BME280_READ_RETRIES) {
      Serial.println(F("[WARN] Reinitializing BME280 and retrying"));
      if (!initializeBme280()) {
        setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_READ_ERROR);
      }
    }
  }

  bme280Ready = false;
  setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_READ_ERROR);
  return false;
}

bool readIna219(float &voltage, float &current) {
  for (uint8_t attempt = 0; attempt < SENSOR_READ_RETRIES; ++attempt) {
    if (ina219Ready && isI2CDeviceResponsive(I2C_0, 0x40)) {
      voltage = ina219.getBusVoltage_V();
      current = ina219.getCurrent_mA() / 1000.0f;
      if (isfinite(voltage) && isfinite(current) &&
          voltage >= 0.0f && voltage <= 32.0f &&
          current >= -10.0f && current <= 10.0f) {
        return true;
      }
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_INVALID_DATA);
    } else {
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_READ_ERROR);
    }

    if (attempt + 1 < SENSOR_READ_RETRIES) {
      delay(SENSOR_SETTLE_DELAY_MS);
      ina219Ready = initializeIna219();
    }
  }

  ina219Ready = false;
  setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_READ_ERROR);
  return false;
}

bool readBh1750(float &light) {
  for (uint8_t attempt = 0; attempt < SENSOR_READ_RETRIES; ++attempt) {
    if (bh1750Ready && isI2CDeviceResponsive(I2C_0, 0x23)) {
      if (!lightMeter.measurementReady(true)) {
        delay(200);
      }
      delay(SENSOR_SETTLE_DELAY_MS);
      light = lightMeter.readLightLevel();
      if (isfinite(light) && light >= 0.0f && light <= 120000.0f) {
        return true;
      }
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_INVALID_DATA);
    } else {
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_READ_ERROR);
    }

    if (attempt + 1 < SENSOR_READ_RETRIES) {
      delay(SENSOR_SETTLE_DELAY_MS);
      bh1750Ready = initializeBh1750();
    }
  }

  bh1750Ready = false;
  setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_READ_ERROR);
  return false;
}

bool readRtcTimestamp(char *timestamp, size_t timestampSize) {
  for (uint8_t attempt = 0; attempt < SENSOR_READ_RETRIES; ++attempt) {
    if (ds3231Ready && isI2CDeviceResponsive(I2C_0, 0x68)) {
      DateTime now = rtc.now();
      if (isValidRtcTime(now) && !rtc.lostPower()) {
        snprintf(timestamp, timestampSize,
                 "%04d-%02d-%02d %02d:%02d",
                 now.year(), now.month(), now.day(),
                 now.hour(), now.minute());
        return true;
      }
    }
    setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_READ_ERROR);
    delay(SENSOR_SETTLE_DELAY_MS);
  }

  return false;
}


// SENSOR READ
bool readSensors(SensorData &data) {
  data.valid = false;
  bme280ReadThisCycle = false;
  ina219ReadThisCycle = false;
  bh1750ReadThisCycle = false;
  ds3231ReadThisCycle = false;
  // Use numeric fallbacks so the payload remains complete even when one
  // peripheral is unavailable. hardware_status identifies the fault.
  data.voltage = 0.0f;
  data.current = 0.0f;
  data.temperature = 0.0f;
  data.humidity = 0.0f;
  data.light = 0.0f;
  snprintf(data.timestamp, sizeof(data.timestamp), "1970-01-01 00:00");

  ds3231ReadThisCycle = readRtcTimestamp(data.timestamp, sizeof(data.timestamp));
  ina219ReadThisCycle = readIna219(data.voltage, data.current);
  bh1750ReadThisCycle = readBh1750(data.light);

  if (!bme280Ready) {
    bme280Ready = initializeBme280();
  }
  if (bme280Ready) {
    bme280ReadThisCycle = readBme280(data.temperature, data.humidity);
  }

  validateSensorReadings(data);
  updateHardwareStatus();

  data.valid = bme280Ready || ina219Ready || bh1750Ready || ds3231Ready;

  Serial.printf("[Sensors] %s | V=%.3fV | I=%.4fA | T=%.2f°C | H=%.2f%% | L=%.1flux\n",
    data.timestamp, data.voltage, data.current,
    data.temperature, data.humidity, data.light);

  return data.valid;
}

// HARDWARE DIAGNOSTICS
void validateSensorReadings(SensorData &data) {
  if (bme280Ready && bme280ReadThisCycle) {
    if (isnan(data.temperature) || isnan(data.humidity)) {
      Serial.println(F("[ERROR] BME280 returned NaN"));
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_READ_ERROR);
      data.temperature = 0.0f;
      data.humidity = 0.0f;
    } else if (data.temperature < -40.0f || data.temperature > 85.0f ||
               data.humidity < 0.0f || data.humidity > 100.0f) {
      Serial.println(F("[ERROR] BME280 returned impossible data"));
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_INVALID_DATA);
    } else {
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_OK);
    }
  }

  if (ina219Ready && ina219ReadThisCycle) {
    if (isnan(data.voltage) || isnan(data.current)) {
      Serial.println(F("[ERROR] INA219 returned NaN"));
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_READ_ERROR);
      data.voltage = 0.0f;
      data.current = 0.0f;
    } else if (data.voltage < 0.0f || data.voltage > 32.0f ||
               data.current < -10.0f || data.current > 10.0f) {
      Serial.println(F("[ERROR] INA219 returned impossible data"));
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_INVALID_DATA);
    } else {
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_OK);
    }
  }

  if (bh1750Ready && bh1750ReadThisCycle) {
    if (isnan(data.light)) {
      Serial.println(F("[ERROR] BH1750 returned NaN"));
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_READ_ERROR);
      data.light = 0.0f;
    } else if (data.light < 0.0f || data.light > 120000.0f) {
      Serial.println(F("[ERROR] BH1750 returned impossible light data"));
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_INVALID_DATA);
    } else {
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_OK);
    }
  }
}

void updateHardwareStatus() {
  if (ds3231Ready) {
    if (rtc.lostPower()) {
      Serial.println(F("[WARN] DS3231 lost power"));
      setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_DEVICE_SPECIFIC_ERROR);
    } else if (ds3231ReadThisCycle) {
      setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_OK);
    }
  }
  printHardwareStatus();
}

void appendHardwareStatus(JsonDocument &doc) {
  JsonObject status = doc.createNestedObject("hardware_status");
  status["bme280"] = hardwareStatus.bme280;
  status["ina219"] = hardwareStatus.ina219;
  status["bh1750"] = hardwareStatus.bh1750;
  status["ds3231"] = hardwareStatus.ds3231;
}

void printHardwareStatus() {
  Serial.printf("[Diagnostics] Status BME280=%u INA219=%u BH1750=%u DS3231=%u\n",
    hardwareStatus.bme280, hardwareStatus.ina219,
    hardwareStatus.bh1750, hardwareStatus.ds3231);
}

void setHardwareStatus(const char *device, uint8_t &status, uint8_t nextStatus) {
  if (status != nextStatus) {
    Serial.printf("[Diagnostics] %s status changed: %u -> %u\n", device, status, nextStatus);
    status = nextStatus;
  }
}

bool isValidRtcTime(const DateTime &time) {
  return time.year() >= 2020 && time.year() <= 2099 &&
         time.month() >= 1 && time.month() <= 12 &&
         time.day() >= 1 && time.day() <= 31 &&
         time.hour() <= 23 && time.minute() <= 59;
}

bool syncRtcFromNtp() {
  if (!ds3231Ready) {
    return false;
  }

  // Force a fresh RTC correction every time the ESP32 boots so the clock is
  // reset from NTP instead of trusting the previous in-memory RTC state.
  configTime(UTC_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  struct tm timeinfo;
  Serial.print(F("[Time] Synchronizing RTC with NTP"));

  for (uint8_t attempt = 0; attempt < 20; ++attempt) {
    if (getLocalTime(&timeinfo, 500) && timeinfo.tm_year >= 120) {
      rtc.adjust(DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1,
                         timeinfo.tm_mday, timeinfo.tm_hour,
                         timeinfo.tm_min, timeinfo.tm_sec));
      setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_OK);
      Serial.println();
      Serial.println(F("[Time] RTC synchronized from NTP"));
      return true;
    }
    Serial.print('.');
  }

  Serial.println();
  Serial.println(F("[Time] NTP sync failed; retaining RTC time"));
  return false;
}

bool isNightTime(const DateTime &time) {
  return time.hour() >= NIGHT_START_HOUR || time.hour() < NIGHT_END_HOUR;
}

bool shouldSleepAtNight(const SensorData &data) {
  if (ds3231Ready) {
    DateTime currentTime = rtc.now();
    if (isValidRtcTime(currentTime) && !rtc.lostPower()) {
      // RTC time is authoritative; lux alone can be reduced by clouds or shade.
      return isNightTime(currentTime);
    }
  }

  // If the RTC cannot be trusted, use the light sensor as a safe fallback.
  return bh1750ReadThisCycle && isfinite(data.light) &&
    data.light < DAYLIGHT_THRESHOLD_LUX;
}

bool isI2CDeviceResponsive(TwoWire &bus, uint8_t address) {
  bus.beginTransmission(address);
  return bus.endTransmission() == 0;
}


// WIFI CONNECTION
bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print(F("[WiFi] Connecting"));

  const uint8_t MAX_RETRIES = 20;
  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < MAX_RETRIES) {
    delay(500);
    Serial.print('.');
    attempts++;
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[WiFi] Connection failed"));
    return false;
  }

  Serial.printf("[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
  return true;
}

// JSON BUILDER
String buildJSON(const SensorData &data) {
  // Diagnostics plus the backend-compatible device_id and lux fields need
  // more capacity than the original flat payload format.
  StaticJsonDocument<512> doc;

  doc["device_id"]   = DEVICE_ID;
  doc["timestamp"]   = data.timestamp;
  doc["voltage"]     = serialized(String(data.voltage, 3));
  doc["current"]     = serialized(String(data.current, 4));
  doc["temperature"] = serialized(String(data.temperature, 2));
  doc["humidity"]    = serialized(String(data.humidity, 2));
  doc["light"]       = serialized(String(data.light, 1));
  // `lux` is the backend ingestion field; keep `light` above for compatibility.
  doc["lux"]         = serialized(String(data.light, 1));
  updateHardwareStatus();
  appendHardwareStatus(doc);

  String payload;
  serializeJson(doc, payload);
  return payload;
}

// HTTPS POST THROUGH NGROK
bool publishData(const SensorData &data) {
  String payload = buildJSON(data);
  return publishDataToNgrok(payload);
}

bool publishDataToNgrok(const String &payload) {
  const String endpoint = NGROK_TELEMETRY_URL;
  if (!endpoint.startsWith("https://") || endpoint.indexOf("YOUR-NGROK-DOMAIN") >= 0) {
    Serial.println(F("[HTTPS] Set NGROK_TELEMETRY_URL before enabling USE_NGROK_HTTPS."));
    return false;
  }

  WiFiClientSecure secureClient;
  // ngrok uses a publicly trusted, rotating TLS certificate. ESP32 Arduino
  // sketches do not ship a root store, so this development configuration skips
  // certificate verification. For production, replace this with setCACert().
  secureClient.setInsecure();

  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(secureClient, endpoint)) {
    Serial.println(F("[HTTPS] Could not start request."));
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Accept", "application/json");
  Serial.printf("[HTTPS] POST %s\n", endpoint.c_str());
  int statusCode = http.POST(payload);
  String response = http.getString();
  http.end();

  if (statusCode >= 200 && statusCode < 300) {
    Serial.printf("[HTTPS] Success, status=%d response=%s\n", statusCode, response.c_str());
    return true;
  }

  Serial.printf("[HTTPS] Failed, status=%d response=%s\n", statusCode, response.c_str());
  return false;
}

// ShutDown Peripherals
void shutdownPeripherals() {
  Serial.flush();

  WiFi.disconnect(true);   
  WiFi.mode(WIFI_OFF);
  delay(200);

  I2C_0.end();
  I2C_1.end();
  delay(100);
}

// NIGHT DEEP SLEEP
void goToNightSleep() {
  Serial.printf("[Sleep] Night sleep for %llu minutes...\n", NIGHT_SLEEP_MINUTES);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(NIGHT_SLEEP_DURATION);
  esp_deep_sleep_start();
}
