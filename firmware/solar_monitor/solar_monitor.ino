/*
 * Solar Panel Monitor - ESP32 Night Sleep + MQTT
 *
 * Hardware:
 *   I2C Bus 0 (GPIO 21/22): DS3231 RTC, BH1750, INA219
 *   I2C Bus 1 (GPIO 16/17): BME280
 *
 * Night sleep check interval: 10 minutes
 */

#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <RTClib.h>
#include <BH1750.h>
#include <Adafruit_INA219.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>
#include <time.h>


// USER CONFIGURATION
#define WIFI_SSID       "Batman"
#define WIFI_PASSWORD   "gothamneedsme"
#define MQTT_SERVER     "192.168.65.2"
#define MQTT_PORT       1883
#define MQTT_USER       ""   // leave "" if none
#define MQTT_PASSWORD   ""   // leave "" if none
#define MQTT_CLIENT_ID  "solar_monitor_01"
#define MQTT_TOPIC      "solar/sensors"

// Communication mode: keep 0 for the existing MQTT path.  Set to 1 only
// after starting the backend with --https and copying its printed endpoint.
#define TRANSPORT_HTTPS 0
#define HTTPS_INGEST_URL "https://example.trycloudflare.com/ingest/sensor"
// Must match ESP32_INGEST_TOKEN if that backend environment variable is set.
#define HTTPS_DEVICE_TOKEN ""


// TIMING
#define NIGHT_SLEEP_MINUTES 10ULL
#define uS_TO_MIN       (60ULL * 1000000ULL)
#define NIGHT_SLEEP_DURATION (NIGHT_SLEEP_MINUTES * uS_TO_MIN)
#define DAYLIGHT_THRESHOLD_LUX 5.0f
#define NIGHT_START_HOUR 20
#define NIGHT_END_HOUR 6
#define PUBLISH_INTERVAL_MS (10UL * 60UL * 1000UL)
#define SENSOR_CHECK_INTERVAL_MS 10000UL

#define NTP_SERVER      "pool.ntp.org"
#define UTC_OFFSET_SEC  0
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

WiFiClient        wifiClient;
PubSubClient      mqttClient(wifiClient);
WiFiClientSecure  httpsClient;

// HARDWARE DIAGNOSTICS
// These numeric values are sent in every MQTT telemetry payload.
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
bool    connectMQTT();
bool    publishData(const SensorData &data);
bool    publishDataHttps(const String &payload);
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

  SensorData data;

  initSensors();

#if !TRANSPORT_HTTPS
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
#endif

  if (!connectWiFi()) {
    Serial.println(F("[ERROR] WiFi failed. Will retry."));
    return;
  }

  syncRtcFromNtp();

  // A failed sensor is diagnostic information, not a reason to prevent the
  // remaining healthy sensors from publishing telemetry.
  readSensors(data);

  if (shouldSleepAtNight(data)) {
    Serial.println(F("[Night] Night schedule detected. Entering deep sleep."));
    shutdownPeripherals();
    goToNightSleep();
    return;
  }

#if !TRANSPORT_HTTPS
  if (!connectMQTT()) {
    Serial.println(F("[ERROR] MQTT failed. Will retry."));
    return;
  }
#endif

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

#if !TRANSPORT_HTTPS
  if (!mqttClient.connected()) {
    connectMQTT();
  } else {
    mqttClient.loop();
  }
#endif

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

  if (
#if !TRANSPORT_HTTPS
      mqttClient.connected() &&
#endif
      now - lastPublishTime >= PUBLISH_INTERVAL_MS) {
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
  if (!ina219.begin(&I2C_0)) {
    Serial.println(F("[ERROR] INA219 not found"));
    setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_DEVICE_NOT_FOUND);
  } else {
    ina219Ready = true;
    Serial.println(F("[OK] INA219 initialized"));
    setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_OK);
  }

  // BH1750 (I2C Bus 0)
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2C_0)) {
    Serial.println(F("[ERROR] BH1750 not found"));
    setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_DEVICE_NOT_FOUND);
  } else {
    bh1750Ready = true;
    Serial.println(F("[OK] BH1750 initialized"));
    setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_OK);
  }

  // BME280 (I2C Bus 1; try both supported addresses)
  if (!bme.begin(0x77, &I2C_1) && !bme.begin(0x76, &I2C_1)) {
    Serial.println(F("[ERROR] BME280 not found"));
    setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_DEVICE_NOT_FOUND);
  } else {
    bme280Ready = true;
    delay(300);
    Serial.println(F("[OK] BME280 initialized"));
    setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_OK);
  }

  printHardwareStatus();
  return bme280Ready || ina219Ready || bh1750Ready || ds3231Ready;
}


// SENSOR READ
bool readSensors(SensorData &data) {
  data.valid = false;
  bme280ReadThisCycle = false;
  ina219ReadThisCycle = false;
  bh1750ReadThisCycle = false;
  ds3231ReadThisCycle = false;
  // Use numeric fallbacks so the existing MQTT fields remain present even
  // when one peripheral is unavailable. hardware_status identifies the fault.
  data.voltage = 0.0f;
  data.current = 0.0f;
  data.temperature = 0.0f;
  data.humidity = 0.0f;
  data.light = 0.0f;
  snprintf(data.timestamp, sizeof(data.timestamp), "1970-01-01 00:00");

  // RTC timestamp
  if (ds3231Ready) {
    if (!isI2CDeviceResponsive(I2C_0, 0x68)) {
      Serial.println(F("[ERROR] DS3231 I2C communication failed"));
      setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_READ_ERROR);
    } else {
      DateTime now = rtc.now();
      if (isValidRtcTime(now)) {
        snprintf(data.timestamp, sizeof(data.timestamp),
                 "%04d-%02d-%02d %02d:%02d",
                 now.year(), now.month(), now.day(),
                 now.hour(), now.minute());
        ds3231ReadThisCycle = true;
      } else {
        Serial.println(F("[ERROR] DS3231 returned an invalid timestamp"));
        setHardwareStatus("DS3231", hardwareStatus.ds3231, STATUS_READ_ERROR);
      }
    }
  }

  // INA219: Voltage & Current
  if (ina219Ready) {
    if (!isI2CDeviceResponsive(I2C_0, 0x40)) {
      Serial.println(F("[ERROR] INA219 I2C communication failed"));
      setHardwareStatus("INA219", hardwareStatus.ina219, STATUS_READ_ERROR);
    } else {
      data.voltage = ina219.getBusVoltage_V();
      data.current = ina219.getCurrent_mA() / 1000.0f;   // Convert to Amps
      ina219ReadThisCycle = true;
    }
  }

  // BH1750: Light
  if (bh1750Ready) {
    if (!isI2CDeviceResponsive(I2C_0, 0x23)) {
      Serial.println(F("[ERROR] BH1750 I2C communication failed"));
      setHardwareStatus("BH1750", hardwareStatus.bh1750, STATUS_READ_ERROR);
    } else {
      if (!lightMeter.measurementReady(true)) {
        Serial.println(F("[WARN] BH1750 measurement not ready; waiting"));
        delay(200);   // Wait for measurement to complete
      }
      data.light = lightMeter.readLightLevel();
      bh1750ReadThisCycle = true;
    }
  }

  // BME280: Temperature & Humidity
  if (bme280Ready) {
    if (!isI2CDeviceResponsive(I2C_1, 0x76)) {
      Serial.println(F("[ERROR] BME280 I2C communication failed"));
      setHardwareStatus("BME280", hardwareStatus.bme280, STATUS_READ_ERROR);
    } else {
      data.temperature = bme.readTemperature();
      data.humidity    = bme.readHumidity();
      bme280ReadThisCycle = true;
    }
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

  DateTime rtcTime = rtc.now();
  if (isValidRtcTime(rtcTime) && !rtc.lostPower()) {
    return true;
  }

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
  return bh1750Ready && data.light < DAYLIGHT_THRESHOLD_LUX;
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

// MQTT CONNECTION
bool connectMQTT() {
  const uint8_t MAX_RETRIES = 3;

  for (uint8_t i = 0; i < MAX_RETRIES; i++) {
    Serial.printf("[MQTT] Connecting (attempt %d)...\n", i + 1);

    bool connected = (strlen(MQTT_USER) > 0)
      ? mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)
      : mqttClient.connect(MQTT_CLIENT_ID);

    if (connected) {
      Serial.println(F("[MQTT] Connected"));
      return true;
    }

    Serial.printf("[MQTT] Failed, rc=%d\n", mqttClient.state());
    delay(1000);
  }

  return false;
}

// JSON BUILDER
String buildJSON(const SensorData &data) {
  // Nested diagnostics require more room than the original flat payload.
  StaticJsonDocument<384> doc;

  doc["timestamp"]   = data.timestamp;
  doc["voltage"]     = serialized(String(data.voltage, 3));
  doc["current"]     = serialized(String(data.current, 4));
  doc["temperature"] = serialized(String(data.temperature, 2));
  doc["humidity"]    = serialized(String(data.humidity, 2));
  doc["light"]       = serialized(String(data.light, 1));
  updateHardwareStatus();
  appendHardwareStatus(doc);

  String payload;
  serializeJson(doc, payload);
  return payload;
}

// TRANSPORT PUBLISH (the JSON structure is shared by MQTT and HTTPS)
bool publishData(const SensorData &data) {
  String payload = buildJSON(data);

#if TRANSPORT_HTTPS
  Serial.printf("[HTTPS] Posting: %s\n", payload.c_str());
  return publishDataHttps(payload);
#else
  Serial.printf("[MQTT] Publishing: %s\n", payload.c_str());
  return mqttClient.publish(MQTT_TOPIC, payload.c_str(), true);
#endif
}

bool publishDataHttps(const String &payload) {
  // Quick Tunnel URLs use publicly trusted certificates.  For production,
  // replace this with setCACert(...) containing the active issuing root CA.
  // setInsecure is used here so a changing trycloudflare.com certificate does
  // not break field testing; it still encrypts traffic but skips CA validation.
  httpsClient.setInsecure();

  HTTPClient http;
  if (!http.begin(httpsClient, HTTPS_INGEST_URL)) {
    Serial.println(F("[HTTPS] Could not start HTTPS connection"));
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  if (strlen(HTTPS_DEVICE_TOKEN) > 0) {
    http.addHeader("X-Device-Token", HTTPS_DEVICE_TOKEN);
  }
  int statusCode = http.POST(payload);
  http.end();

  if (statusCode == HTTP_CODE_ACCEPTED) {
    Serial.println(F("[HTTPS] Telemetry accepted"));
    return true;
  }
  Serial.printf("[HTTPS] POST failed, status=%d\n", statusCode);
  return false;
}

// ShutDown Peripherals
void shutdownPeripherals() {
  Serial.flush();

#if !TRANSPORT_HTTPS
  if (mqttClient.connected()) {
    mqttClient.disconnect();
    delay(100);
  }
#endif

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
