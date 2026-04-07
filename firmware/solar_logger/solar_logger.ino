#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <Adafruit_INA219.h>
#include <RTClib.h>

#define LED_PIN 2
#define SD_CS_PIN       5
#define I2C_SDA0        21
#define I2C_SCL0        22
#define I2C_SDA1        16
#define I2C_SCL1        17
#define SLEEP_MINUTES   10
#define uS_TO_S         1000000
#define SLEEP_DURATION  (SLEEP_MINUTES * 60 * uS_TO_S)

TwoWire I2C_0 = TwoWire(0); // Bus 0 — RTC, BH1750, INA219
TwoWire I2C_1 = TwoWire(1); // Bus 1 — BME280 alone

Adafruit_BME280 bme;
BH1750          lightMeter;
Adafruit_INA219 ina219;
RTC_DS3231      rtc;

const char* LOG_FILE   = "/solar_log.csv";
const char* CSV_HEADER = "timestamp,voltage_V,current_mA,power_mW,temp_C,humidity_pct,pressure_hPa,light_lux,efficiency_index";

struct SensorData {
  String timestamp;
  float  voltage, current, power;
  float  temperature, humidity, pressure;
  float  light, efficiency;
};

void initRTC();
void initSensors();
void initSD();
SensorData readAllSensors();
void logToSD(const SensorData& d);
void printData(const SensorData& d);

// ============================================================
//  Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  blinkLED(4, 150);

  Serial.println("\n=== Solar Logger Waking Up ===");

  // Init both I2C buses
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

  Serial.println("Going to sleep...\n");
  blinkLED(2, 150);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(SLEEP_DURATION);
  esp_deep_sleep_start();
}

void loop() {}

// ============================================================
//  LED: Startup Indicator
// ============================================================
void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}

// ============================================================
//  Init: RTC
// ============================================================
void initRTC() {
  if (!rtc.begin(&I2C_0)) {
    Serial.println("[ERROR] RTC not found. Halting.");
    while (1);
  }
  if (rtc.lostPower()) {
    Serial.println("[WARN] RTC lost power — set to compile time.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  Serial.println("[OK] RTC initialized.");
}
// ============================================================
//  Init: Sensors
// ============================================================
void initSensors() {
  // BME280 on dedicated Bus 1
  delay(500);
  if (!bme.begin(0x77, &I2C_1)) {
    Serial.println("[ERROR] BME280 failed.");
  } else {
    delay(300);
    Serial.println("[OK] BME280 initialized on Bus 1.");
  }

  // BH1750 on Bus 0
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &I2C_0);
  Serial.println("[OK] BH1750 initialized on Bus 0.");

  // INA219 on Bus 0
  if (!ina219.begin(&I2C_0)) {
    Serial.println("[ERROR] INA219 failed.");
  } else {
    Serial.println("[OK] INA219 initialized on Bus 0.");
  }
}

// ============================================================
//  Init: SD Card
// ============================================================
void initSD() {
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println("[ERROR] SD card failed. Halting.");
    while (1);
  }
  Serial.println("[OK] SD card initialized.");

  if (!SD.exists(LOG_FILE)) {
    File f = SD.open(LOG_FILE, FILE_WRITE);
    if (f) {
      f.println(CSV_HEADER);
      f.close();
      Serial.println("[OK] CSV header written.");
    }
  }
}

// ============================================================
//  Read All Sensors
// ============================================================
SensorData readAllSensors() {
  SensorData d;

  // Timestamp
  DateTime now = rtc.now();
  char buf[20];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute());
  d.timestamp = String(buf);

  // INA219
  d.voltage = ina219.getBusVoltage_V();
  d.current = ina219.getCurrent_mA();
  d.power   = ina219.getPower_mW();
  if (d.current < 0) d.current = 0;
  if (d.power   < 0) d.power   = 0;

  // BME280
  d.temperature = bme.readTemperature();
  d.humidity    = bme.readHumidity();
  d.pressure    = bme.readPressure() / 100.0F;

  // BH1750
  d.light = lightMeter.readLightLevel();
  if (d.light < 0) d.light = 0;

  // Efficiency index
  d.efficiency = (d.light > 10.0) ? (d.power / d.light) : 0.0;

  return d;
}

// ============================================================
//  Log to SD
// ============================================================
void logToSD(const SensorData& d) {
  File f = SD.open(LOG_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("[ERROR] Could not open log file.");
    return;
  }

  f.print(d.timestamp);      f.print(",");
  f.print(d.voltage, 3);     f.print(",");
  f.print(d.current, 2);     f.print(",");
  f.print(d.power,   2);     f.print(",");
  f.print(d.temperature, 2); f.print(",");
  f.print(d.humidity,    2); f.print(",");
  f.print(d.pressure,    2); f.print(",");
  f.print(d.light,       1); f.print(",");
  f.println(d.efficiency, 4);

  f.close();
  Serial.println("[OK] Data logged to SD.");
}

// ============================================================
//  Print to Serial
// ============================================================
void printData(const SensorData& d) {
  Serial.println("─────────────────────────────");
  Serial.print("Time       : "); Serial.println(d.timestamp);
  Serial.print("Voltage    : "); Serial.print(d.voltage, 3);     Serial.println(" V");
  Serial.print("Current    : "); Serial.print(d.current, 2);     Serial.println(" mA");
  Serial.print("Power      : "); Serial.print(d.power,   2);     Serial.println(" mW");
  Serial.print("Temp       : "); Serial.print(d.temperature, 2); Serial.println(" °C");
  Serial.print("Humidity   : "); Serial.print(d.humidity,    2); Serial.println(" %");
  Serial.print("Pressure   : "); Serial.print(d.pressure,    2); Serial.println(" hPa");
  Serial.print("Light      : "); Serial.print(d.light,       1); Serial.println(" lux");
  Serial.print("Efficiency : "); Serial.println(d.efficiency, 4);
  Serial.println("─────────────────────────────");
}