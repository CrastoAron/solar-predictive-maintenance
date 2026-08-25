/*
 * Solar Panel Monitor - ESP32 Test Program with Dummy Data
 * 
 * This sketch simulates solar panel sensor telemetry with realistic gradual drift,
 * day/night cycles, and occasional simulated abnormal conditions. It publishes the
 * MQTT payload expected by backend/services/mqtt_client.py.
 * 
 * Hardware:
 *   None required (ESP32 only)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// USER CONFIGURATION (Matching the original project)
#define WIFI_SSID       "Batman"
#define WIFI_PASSWORD   "gothamneedsme"
#define MQTT_SERVER     "YOUR_MQTT_BROKER_IP"
#define MQTT_PORT       1883
#define MQTT_USER       ""   // leave "" if none
#define MQTT_PASSWORD   ""   // leave "" if none
#define MQTT_CLIENT_ID  "solar_monitor_test_01" // Changed slightly to avoid conflict if both run
#define MQTT_TOPIC      "solar/sensors"
#define DEVICE_ID       "esp32-01"             // Must match DEFAULT_DEVICE_ID in backend/.env

// NTP keeps MQTT samples inside the backend's recent-data query window. The
// timestamp is sent in UTC (`YYYY-MM-DDTHH:MM:SSZ`).
#define NTP_SERVER      "pool.ntp.org"
#define UTC_OFFSET_SEC  0
#define DAYLIGHT_OFFSET_SEC 0

// Use local solar time only for the simulated sun curve. This does not affect
// the UTC timestamp sent to the backend. Set to 19800 for India, for example.
#define SIMULATION_UTC_OFFSET_SEC 19800

// PUBLISH INTERVAL
#define PUBLISH_INTERVAL_MS 5000  // 5 seconds

// WIFI & MQTT RETRY TIMERS
#define WIFI_RETRY_INTERVAL_MS 10000 // Retry Wi-Fi every 10s if disconnected
#define MQTT_RETRY_INTERVAL_MS 5000  // Retry MQTT every 5s if disconnected

// SENSOR DATA STRUCT (Matching the original project)
struct SensorData {
  char    timestamp[21];   // "YYYY-MM-DDTHH:MM:SSZ"
  float   voltage;
  float   current;
  float   temperature;
  float   humidity;
  float   light;
  bool    valid;
};

// SIMULATION STATES FOR ABNORMAL CONDITIONS
enum SimulationState {
  STATE_NORMAL,
  STATE_OVERTEMP,
  STATE_UNDERVOLTAGE,
  STATE_OVERCURRENT
};

// The simulator has no physical sensors, but it emits the same diagnostics
// shape as solar_monitor so backend and frontend integration remains uniform.
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
  STATUS_OK,
  STATUS_OK,
  STATUS_OK,
  STATUS_OK
};

// GLOBAL VARIABLES
WiFiClient        wifiClient;
PubSubClient      mqttClient(wifiClient);
SimulationState   simState = STATE_NORMAL;
int               stateCounter = 0;
unsigned long     lastPublishTime = 0;
unsigned long     lastWiFiCheckTime = 0;
unsigned long     lastMQTTCheckTime = 0;

// FORWARD DECLARATIONS
void connectWiFi();
void connectMQTT();
bool syncClock();
bool getTimestampAndSolarTime(char *timestamp, size_t timestampLen, int &solarHour, int &solarMinute);
void generateDummyData(SensorData &data);
bool publishSensorData(const SensorData &data);
String buildJSON(const SensorData &data);
void updateHardwareStatus();
void appendHardwareStatus(JsonDocument &doc);
void printHardwareStatus();

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println(F("\n=============================================="));
  Serial.println(F("[Solar Monitor Test] Starting Test Program..."));
  Serial.println(F("=============================================="));

  // Initialize random seed
  randomSeed(analogRead(0));

  // Set up MQTT client
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);

  // Initial Wi-Fi connection
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    syncClock();
  }
}

void loop() {
  unsigned long now = millis();

  // 1. Maintain Wi-Fi Connection (Non-blocking)
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWiFiCheckTime >= WIFI_RETRY_INTERVAL_MS) {
      lastWiFiCheckTime = now;
      Serial.println(F("[WiFi] Connection lost. Retrying..."));
      connectWiFi();
      if (WiFi.status() == WL_CONNECTED) {
        syncClock();
      }
    }
    return; // Don't proceed to MQTT if Wi-Fi is down
  }

  // 2. Maintain MQTT Connection & Run Loop (Non-blocking)
  if (!mqttClient.connected()) {
    if (now - lastMQTTCheckTime >= MQTT_RETRY_INTERVAL_MS) {
      lastMQTTCheckTime = now;
      Serial.println(F("[MQTT] Connection lost. Retrying..."));
      connectMQTT();
    }
  } else {
    mqttClient.loop(); // Handle incoming packets & keepalives
  }

  // 3. Publish simulated data at configurable intervals
  if (now - lastPublishTime >= PUBLISH_INTERVAL_MS) {
    lastPublishTime = now;

    // Only publish if we are fully connected
    if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
      SensorData data;
      generateDummyData(data);
      publishSensorData(data);
    }
  }
}

// NTP CLOCK
bool syncClock() {
  configTime(UTC_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  struct tm timeinfo;
  Serial.print(F("[Time] Synchronizing with NTP"));
  for (uint8_t attempt = 0; attempt < 20; ++attempt) {
    if (getLocalTime(&timeinfo, 500)) {
      Serial.println();
      Serial.println(F("[Time] UTC clock synchronized"));
      return true;
    }
    Serial.print('.');
  }
  Serial.println();
  Serial.println(F("[Time] NTP sync failed. Samples will wait for a valid clock."));
  return false;
}

bool getTimestampAndSolarTime(char *timestamp, size_t timestampLen, int &solarHour, int &solarMinute) {
  time_t now = time(nullptr);
  // A valid NTP-synchronized ESP32 clock must be later than 2024-01-01.
  if (now < 1704067200) return false;

  struct tm utcTime;
  gmtime_r(&now, &utcTime);
  strftime(timestamp, timestampLen, "%Y-%m-%dT%H:%M:%SZ", &utcTime);

  time_t solarNow = now + SIMULATION_UTC_OFFSET_SEC;
  struct tm solarTime;
  gmtime_r(&solarNow, &solarTime);
  solarHour = solarTime.tm_hour;
  solarMinute = solarTime.tm_min;
  return true;
}

// WIFI CONNECTION
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[WiFi] Connecting to SSID: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    // Non-blocking connect check during setup or reconnect attempts
    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print('.');
      attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[WiFi] Connected successfully. IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
      Serial.println(F("[WiFi] Connection failed. Will retry later."));
    }
  }
}

// MQTT CONNECTION
void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.printf("[MQTT] Connecting to broker: %s:%d\n", MQTT_SERVER, MQTT_PORT);
  
  bool connected = (strlen(MQTT_USER) > 0)
    ? mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)
    : mqttClient.connect(MQTT_CLIENT_ID);

  if (connected) {
    Serial.println(F("[MQTT] Connected successfully"));
  } else {
    Serial.printf("[MQTT] Connection failed, rc=%d. Will retry.\n", mqttClient.state());
  }
}

// DUMMY SENSOR DATA GENERATION WITH GRADUAL DRIFT
void generateDummyData(SensorData &data) {
  int solarHour;
  int solarMinute;
  if (!getTimestampAndSolarTime(data.timestamp, sizeof(data.timestamp), solarHour, solarMinute)) {
    data.valid = false;
    return;
  }

  // 2. Manage Simulation State Transitions
  stateCounter++;
  if (simState == STATE_NORMAL) {
    // Transition check every ~2 minutes (24 cycles of 5s)
    if (stateCounter >= 24) {
      stateCounter = 0;
      int r = random(0, 100);
      if (r < 5) {
        simState = STATE_OVERTEMP;
        Serial.println(F("\n>>> [ALERT] Simulating Abnormal Condition: Overtemperature <<<"));
      } else if (r < 10) {
        simState = STATE_UNDERVOLTAGE;
        Serial.println(F("\n>>> [ALERT] Simulating Abnormal Condition: Battery Undervoltage <<<"));
      } else if (r < 15) {
        simState = STATE_OVERCURRENT;
        Serial.println(F("\n>>> [ALERT] Simulating Abnormal Condition: Panel Overcurrent <<<"));
      }
    }
  } else {
    // Return to normal state after 8 cycles (~40 seconds)
    if (stateCounter >= 8) {
      stateCounter = 0;
      simState = STATE_NORMAL;
      Serial.println(F("\n>>> [Simulation] Returning to Normal Conditions <<<"));
    }
  }

  // 3. Generate Day/Night (Diurnal) Cycle for Light (BH1750)
  float baseLight = 0.0;
  if (solarHour >= 6 && solarHour < 18) {
    // Peak light at 12:00 (midday)
    float hourAngle = ((solarHour - 6) + (solarMinute / 60.0)) / 12.0 * PI;
    baseLight = sin(hourAngle) * 55000.0; // Peak around 55,000 Lux
    data.light = baseLight + random(-1500, 1500);
    if (data.light < 0) data.light = 0;
  } else {
    // Nighttime leakage or moonlight
    data.light = random(0, 50) / 10.0; // 0.0 to 5.0 Lux
  }

  // 4. Generate Temperature (BME280)
  // Higher light intensity causes solar panel temp to rise (heat loading)
  float solarHeating = (data.light / 55000.0) * 15.0; // Up to 15C rise from sun
  float normalTemp = 20.0 + solarHeating;             // Base temp ranges 20C - 35C
  
  static float lastTemp = 22.0;
  float tempDrift = random(-30, 30) / 100.0;          // Gradual walk (-0.3C to +0.3C)
  lastTemp = constrain(lastTemp + tempDrift, 15.0, 40.0);

  if (simState == STATE_OVERTEMP) {
    // Rapidly increase temperature into abnormal territory (up to 65C)
    lastTemp = constrain(lastTemp + random(100, 250) / 100.0, 15.0, 65.0);
    data.temperature = lastTemp;
  } else {
    // Slowly return/stay near normal
    if (lastTemp > normalTemp) lastTemp -= 0.2;
    else if (lastTemp < normalTemp) lastTemp += 0.2;
    data.temperature = lastTemp;
  }

  // 5. Generate Humidity (BME280)
  // Humidity changes inversely with temperature
  float targetHum = 80.0 - (data.temperature - 20.0) * 1.8;
  static float lastHum = 60.0;
  float humDrift = random(-100, 100) / 100.0;         // Gradual walk (-1.0% to +1.0%)
  lastHum = constrain(lastHum + humDrift, 20.0, 95.0);
  
  // Nudge towards inverse temperature target
  if (lastHum > targetHum) lastHum -= 0.5;
  else if (lastHum < targetHum) lastHum += 0.5;
  data.humidity = lastHum;

  // 6. Generate Voltage (INA219)
  // Solar charger behavior: Voltage peaks during daylight charging, drops at night
  static float lastVolt = 12.6;
  float voltDrift = random(-5, 5) / 100.0;            // Gradual walk (-0.05V to +0.05V)

  if (simState == STATE_UNDERVOLTAGE) {
    // Battery drops to dangerously low levels (simulating discharge/fault)
    lastVolt = constrain(lastVolt - random(15, 35) / 100.0, 8.8, 14.5);
    data.voltage = lastVolt;
  } else {
    float targetVolt = 12.0; // Discharging nighttime baseline
    if (data.light > 15000.0) {
      targetVolt = 13.8;    // Daytime charging voltage
    }
    
    lastVolt = constrain(lastVolt + voltDrift, 11.2, 14.2);
    if (lastVolt < targetVolt) lastVolt += 0.02;
    else if (lastVolt > targetVolt) lastVolt -= 0.02;
    data.voltage = lastVolt;
  }

  // 7. Generate Current (INA219)
  // Current is directly proportional to Solar Light intensity (amps produced)
  float targetCurrent = 0.0;
  if (data.light > 5000.0) {
    targetCurrent = (data.light / 55000.0) * 3.2; // Up to 3.2 Amps at peak sun
  }

  static float lastCurrent = 0.0;
  float currentDrift = random(-10, 10) / 100.0;      // Gradual walk (-0.1A to +0.1A)

  if (simState == STATE_OVERCURRENT) {
    // Current spikes to high levels (simulating panel short or load surge)
    lastCurrent = constrain(lastCurrent + random(40, 100) / 100.0, 0.0, 7.5);
    data.current = lastCurrent;
  } else {
    lastCurrent = constrain(lastCurrent + currentDrift, 0.0, 4.0);
    if (lastCurrent < targetCurrent) lastCurrent += 0.1;
    else if (lastCurrent > targetCurrent) lastCurrent -= 0.1;
    data.current = lastCurrent;
  }

  data.valid = true;
}

// JSON BUILDER
// Required by the backend: device_id, timestamp, voltage, current, lux,
// temperature, and humidity. Values remain JSON numbers (not strings).
String buildJSON(const SensorData &data) {
  StaticJsonDocument<384> doc;

  doc["device_id"]   = DEVICE_ID;
  doc["timestamp"]   = data.timestamp;
  doc["voltage"]     = data.voltage;
  doc["current"]     = data.current;
  doc["lux"]         = data.light;
  doc["temperature"] = data.temperature;
  doc["humidity"]    = data.humidity;
  updateHardwareStatus();
  appendHardwareStatus(doc);

  String payload;
  serializeJson(doc, payload);
  return payload;
}

// HARDWARE DIAGNOSTICS
void updateHardwareStatus() {
  // No physical hardware is read in this sketch. Keep the simulated device
  // health explicit and refresh the packet before every MQTT publish.
  hardwareStatus.bme280 = STATUS_OK;
  hardwareStatus.ina219 = STATUS_OK;
  hardwareStatus.bh1750 = STATUS_OK;
  hardwareStatus.ds3231 = STATUS_OK;
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

// MQTT PUBLISH (Matching the original format)
bool publishSensorData(const SensorData &data) {
  if (!data.valid) {
    Serial.println(F("[MQTT] Skipping sample: UTC clock is not synchronized."));
    return false;
  }

  String payload = buildJSON(data);

  Serial.println(F("---------------------------------------------"));
  Serial.printf("[MQTT] Publishing to Topic: %s\n", MQTT_TOPIC);
  Serial.printf("[MQTT] Payload: %s\n", payload.c_str());
  Serial.println(F("---------------------------------------------"));

  // Do not retain telemetry: a fresh subscriber must not ingest an old sample.
  bool success = mqttClient.publish(MQTT_TOPIC, payload.c_str(), false);
  if (success) {
    Serial.println(F("[MQTT] Publish Successful"));
  } else {
    Serial.println(F("[MQTT] Publish FAILED"));
  }
  return success;
}
