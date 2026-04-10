/*
 * Solar Panel Monitor - ESP32 Deep Sleep + MQTT
 *
 * Hardware:
 *   I2C Bus 0 (GPIO 21/22): DS3231 RTC, BH1750, INA219
 *   I2C Bus 1 (GPIO 16/17): BME280
 *
 * Sleep interval: 10 minutes
 */

#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <RTClib.h>
#include <BH1750.h>
#include <Adafruit_INA219.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>


// USER CONFIGURATION
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define MQTT_SERVER     "YOUR_MQTT_BROKER_IP"
#define MQTT_PORT       1883
#define MQTT_USER       "YOUR_MQTT_USERNAME"   // leave "" if none
#define MQTT_PASSWORD   "YOUR_MQTT_PASSWORD"   // leave "" if none
#define MQTT_CLIENT_ID  "solar_monitor_01"
#define MQTT_TOPIC      "solar/sensors"


// TIMING
#define SLEEP_MINUTES   10ULL
#define uS_TO_MIN       (60ULL * 1000000ULL)
#define SLEEP_DURATION  (SLEEP_MINUTES * uS_TO_MIN)


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
void    goToSleep();
String  buildJSON(const SensorData &data);


// SETUP (runs once per wake cycle)
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println(F("\n[Solar Monitor] Waking up..."));

  // Initialise I2C buses
  I2C_0.begin(I2C0_SDA, I2C0_SCL, 100000);
  I2C_1.begin(I2C1_SDA, I2C1_SCL, 100000);

  SensorData data;

  if (!initSensors()) {
    Serial.println(F("[ERROR] Sensor init failed. Sleeping."));
    goToSleep();
    return;
  }

  if (!readSensors(data)) {
    Serial.println(F("[ERROR] Sensor read failed. Sleeping."));
    goToSleep();
    return;
  }

  // WiFi on only when needed
  if (!connectWiFi()) {
    Serial.println(F("[ERROR] WiFi failed. Sleeping."));
    goToSleep();
    return;
  }

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);

  if (!connectMQTT()) {
    Serial.println(F("[ERROR] MQTT failed. Sleeping."));
    WiFi.disconnect(true);
    goToSleep();
    return;
  }

  if (publishData(data)) {
    Serial.println(F("[OK] Data published."));
  } else {
    Serial.println(F("[ERROR] Publish failed."));
  }

  shutdownPeripherals();
  goToSleep();
}

void loop() {
  // Never reached — deep sleep restarts via setup()
}


// SENSOR INIT
bool initSensors() {
  // RTC
  if (!rtc.begin(&I2C_0)) {
    Serial.println(F("[ERROR] DS3231 not found"));
    return false;
  }
  if (rtc.lostPower()) {
    Serial.println(F("[WARN] RTC lost power — time may be wrong"));
  }

  // INA219 (I2C Bus 0, default address 0x40)
  if (!ina219.begin(&I2C_0)) {
    Serial.println(F("[ERROR] INA219 not found"));
    return false;
  }

  // BH1750 (I2C Bus 0)
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2C_0)) {
    Serial.println(F("[ERROR] BH1750 not found"));
    return false;
  }

  // BME280 (I2C Bus 1, default address 0x76)
  if (!bme.begin(0x76, &I2C_1)) {
    Serial.println(F("[ERROR] BME280 not found"));
    return false;
  }

  return true;
}


// SENSOR READ
bool readSensors(SensorData &data) {
  data.valid = false;

  // RTC timestamp
  DateTime now = rtc.now();
  snprintf(data.timestamp, sizeof(data.timestamp),
           "%04d-%02d-%02d %02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute());

  // INA219: Voltage & Current
  data.voltage = ina219.getBusVoltage_V();
  data.current = ina219.getCurrent_mA() / 1000.0f;   // Convert to Amps

  // BH1750: Light
  if (!lightMeter.measurementReady(true)) {
    delay(200);   // Wait for measurement to complete
  }
  data.light = lightMeter.readLightLevel();

  // BME280: Temperature & Humidity
  data.temperature = bme.readTemperature();
  data.humidity    = bme.readHumidity();

  // Basic sanity checks
  if (isnan(data.temperature) || isnan(data.humidity)) {
    Serial.println(F("[ERROR] BME280 returned NaN"));
    return false;
  }
  if (data.light < 0) {
    Serial.println(F("[ERROR] BH1750 returned invalid reading"));
    return false;
  }

  data.valid = true;

  Serial.printf("[Sensors] %s | V=%.3fV | I=%.4fA | T=%.2f°C | H=%.2f%% | L=%.1flux\n",
    data.timestamp, data.voltage, data.current,
    data.temperature, data.humidity, data.light);

  return true;
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
  StaticJsonDocument<256> doc;

  doc["timestamp"]   = data.timestamp;
  doc["voltage"]     = serialized(String(data.voltage, 3));
  doc["current"]     = serialized(String(data.current, 4));
  doc["temperature"] = serialized(String(data.temperature, 2));
  doc["humidity"]    = serialized(String(data.humidity, 2));
  doc["light"]       = serialized(String(data.light, 1));

  String payload;
  serializeJson(doc, payload);
  return payload;
}

// MQTT PUBLISH
bool publishData(const SensorData &data) {
  String payload = buildJSON(data);

  Serial.printf("[MQTT] Publishing: %s\n", payload.c_str());

  return mqttClient.publish(MQTT_TOPIC, payload.c_str(), true);
}

// ShutDown Peripherals
void shutdownPeripherals() {
  Serial.flush();

  if (mqttClient.connected()) {
    mqttClient.disconnect();
    delay(100);
  }

  WiFi.disconnect(true);   
  WiFi.mode(WIFI_OFF);
  delay(200);

  I2C_0.end();
  I2C_1.end();
  delay(100);
}

// DEEP SLEEP
void goToSleep() {
  Serial.printf("[Sleep] Sleeping for %llu minutes...\n", SLEEP_MINUTES);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(SLEEP_DURATION);
  esp_deep_sleep_start();
}
