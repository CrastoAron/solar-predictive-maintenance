#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <Adafruit_INA219.h>
#include <RTClib.h>

#define LED_PIN        2
#define SD_CS_PIN      5
#define I2C_SDA0       21
#define I2C_SCL0       22
#define I2C_SDA1       16
#define I2C_SCL1       17
#define SLEEP_MINUTES  10
#define uS_TO_S        1000000
#define SLEEP_DURATION (SLEEP_MINUTES * 60 * uS_TO_S)

TwoWire I2C_0 = TwoWire(0);   // RTC, BH1750, INA219
TwoWire I2C_1 = TwoWire(1);   // BME280


Adafruit_BME280 bme;
BH1750          lightMeter;
Adafruit_INA219 ina219;
RTC_DS3231      rtc;

// SD / CSV CONFIG
const char* LOG_FILE   = "/solar_log.csv";
const char* CSV_HEADER = "timestamp,voltage_V,current_A,temp_C,humidity_pct,light_lux";


// SENSOR DATA STRUCT
struct SensorData {
  String timestamp;
  float  voltage;
  float  current;
  float  temperature;
  float  humidity;
  float  light;
};

// FORWARD DECLARATIONS
void       blinkLED(int times, int delayMs);
void       initRTC();
void       initSensors();
void       initSD();
SensorData readAllSensors();
void       logToSD(const SensorData& d);
void       printData(const SensorData& d);


void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  blinkLED(4, 150);

  Serial.println(F("\n=== Solar Logger Waking Up ==="));

  I2C_0.begin(I2C_SDA0, I2C_SCL0);
  I2C_0.setClock(100000);
  I2C_1.begin(I2C_SDA1, I2C_SCL1);
  I2C_1.setClock(100000);
  delay(500);

  initRTC();
  initSensors();
  initSD();

  SensorData data = readAllSensors();
  logToSD(data);
  printData(data);

  Serial.println(F("Going to sleep...\n"));
  blinkLED(2, 150);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(SLEEP_DURATION);
  esp_deep_sleep_start();
}

void loop() {}

// LED BLINK
void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}

// INIT: RTC
void initRTC() {
  if (!rtc.begin(&I2C_0)) {
    Serial.println(F("[ERROR] RTC not found. Halting."));
    while (1);
  }
  if (rtc.lostPower()) {
    Serial.println(F("[WARN] RTC lost power — set to compile time."));
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  Serial.println(F("[OK] RTC initialized."));
}

// INIT: SENSORS
void initSensors() {
  // BME280 on Bus 1
  delay(500);
  if (!bme.begin(0x77, &I2C_1)) {
    Serial.println(F("[ERROR] BME280 failed."));
  } else {
    delay(300);
    Serial.println(F("[OK] BME280 initialized on Bus 1."));
  }

  // BH1750 on Bus 0
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2C_0);
  Serial.println(F("[OK] BH1750 initialized on Bus 0."));

  // INA219 on Bus 0
  if (!ina219.begin(&I2C_0)) {
    Serial.println(F("[ERROR] INA219 failed."));
  } else {
    Serial.println(F("[OK] INA219 initialized on Bus 0."));
  }
}

// INIT: SD CARD
void initSD() {
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println(F("[ERROR] SD card failed. Halting."));
    while (1);
  }
  Serial.println(F("[OK] SD card initialized."));

  if (!SD.exists(LOG_FILE)) {
    File f = SD.open(LOG_FILE, FILE_WRITE);
    if (f) {
      f.println(CSV_HEADER);
      f.close();
      Serial.println(F("[OK] CSV header written."));
    }
  }
}

// READ ALL SENSORS
SensorData readAllSensors() {
  SensorData d;

  // Timestamp from RTC
  DateTime now = rtc.now();
  char buf[17];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute());
  d.timestamp = String(buf);

  // INA219 — voltage & current only
  d.voltage = ina219.getBusVoltage_V();
  d.current = ina219.getCurrent_mA() / 1000.0f;
  if (d.current < 0) d.current = 0;

  // BME280 — temperature & humidity only
  d.temperature = bme.readTemperature();
  d.humidity    = bme.readHumidity();

  // BH1750 — light
  d.light = lightMeter.readLightLevel();
  if (d.light < 0) d.light = 0;

  return d;
}


// LOG TO SD
void logToSD(const SensorData& d) {
  File f = SD.open(LOG_FILE, FILE_APPEND);
  if (!f) {
    Serial.println(F("[ERROR] Could not open log file."));
    return;
  }

  f.print(d.timestamp);      f.print(",");
  f.print(d.voltage, 3);     f.print(",");
  f.print(d.current, 2);     f.print(",");
  f.print(d.temperature, 2); f.print(",");
  f.print(d.humidity, 2);    f.print(",");
  f.println(d.light, 1);

  f.close();
  Serial.println(F("[OK] Data logged to SD."));
}

// PRINT TO SERIAL
void printData(const SensorData& d) {
  Serial.println(F("─────────────────────────────"));
  Serial.print(F("Time       : ")); Serial.println(d.timestamp);
  Serial.print(F("Voltage    : ")); Serial.print(d.voltage, 3);     Serial.println(F(" V"));
  Serial.print(F("Current    : ")); Serial.print(d.current, 2);     Serial.println(F(" mA"));
  Serial.print(F("Temp       : ")); Serial.print(d.temperature, 2); Serial.println(F(" °C"));
  Serial.print(F("Humidity   : ")); Serial.print(d.humidity, 2);    Serial.println(F(" %"));
  Serial.print(F("Light      : ")); Serial.print(d.light, 1);       Serial.println(F(" lux"));
  Serial.println(F("─────────────────────────────"));
}