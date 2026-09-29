/*
  OA-NER Screening App — Left Knee Sensor Node
  Board: Standard ESP32 Dev Module

  Wiring:
    MPU6050: VCC -> 3.3V, GND -> GND, SCL -> GPIO22, SDA -> GPIO21, AD0 -> GND
    Flex:    Divider junction -> GPIO4

  Functionality:
    - Independent non-blocking sensor sampling (IMU @ 50Hz, Flex @ 50Hz)
    - Wi-Fi UDP streaming directly to Kneeva backend (Port 5005)
    - Zero dynamic heap allocation (uses lightweight snprintf buffer)
    - Non-blocking Wi-Fi auto-reconnect
*/

#include <WiFi.h>
#include <WiFiUdp.h>
#include <Wire.h>

// ================= USER CONFIGURATION =================
#define NODE_ID "node_left"
#define PATIENT_ID "pat-active"

const char *WIFI_SSID = "PAUL42"; // Replace with your Wi-Fi / Hotspot SSID
const char *WIFI_PASSWORD = "wric42@@";   // Replace with your Wi-Fi password
const char *BACKEND_IP = "192.168.137.1"; // Replace with your PC's IP address
const int BACKEND_PORT = 5005;            // UDP listening port

// ================= HARDWARE PINOUT ====================
const int SDA_PIN = 21;
const int SCL_PIN = 22;
const int FLEX_PIN = 4;

// ================= MPU6050 REGISTER MAP ===============
#define MPU_ADDR 0x68
#define REG_PWR_MGMT_1 0x6B
#define REG_ACCEL_XOUT_H 0x3B
#define REG_WHO_AM_I 0x75

const float ACCEL_SCALE = 16384.0f; // LSB/g (±2g range)
const float GYRO_SCALE = 131.0f;    // LSB/(deg/s) (±250 deg/s range)

int16_t raw_ax, raw_ay, raw_az, raw_temp, raw_gx, raw_gy, raw_gz;

// Latest sensor metrics
float ax_g = 0.0f, ay_g = 0.0f, az_g = 0.0f;
float gx_dps = 0.0f, gy_dps = 0.0f, gz_dps = 0.0f;
int flex_raw = 0;

// ADC Constants
const float ADC_VREF = 3.3f;
const int ADC_MAX = 4095;

// ================= TIMERS (NON-BLOCKING) ==============
unsigned long lastIMU_ms = 0;
unsigned long lastFlex_ms = 0;
unsigned long lastTx_ms = 0;
unsigned long lastReconnect_ms = 0;

const unsigned long IMU_INTERVAL_MS = 20;         // 50Hz
const unsigned long FLEX_INTERVAL_MS = 20;        // 50Hz
const unsigned long TX_INTERVAL_MS = 50;          // 20Hz UDP transmit
const unsigned long RECONNECT_INTERVAL_MS = 5000; // Check Wi-Fi every 5s

// ================= UDP SOCKET =========================
WiFiUDP udp;
char udpBuffer[256];

// ================= SENSOR DRIVERS =====================
bool mpuReadRaw() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0)
    return false;

  uint8_t bytes = Wire.requestFrom(MPU_ADDR, (uint8_t)14, (uint8_t)true);
  if (bytes < 14)
    return false;

  raw_ax = (Wire.read() << 8) | Wire.read();
  raw_ay = (Wire.read() << 8) | Wire.read();
  raw_az = (Wire.read() << 8) | Wire.read();
  raw_temp = (Wire.read() << 8) | Wire.read();
  raw_gx = (Wire.read() << 8) | Wire.read();
  raw_gy = (Wire.read() << 8) | Wire.read();
  raw_gz = (Wire.read() << 8) | Wire.read();
  return true;
}

void checkWiFiReconnect() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastReconnect_ms >= RECONNECT_INTERVAL_MS) {
      lastReconnect_ms = now;
      Serial.println("[Wi-Fi] Connection lost. Attempting reconnect...");
      WiFi.disconnect();
      WiFi.reconnect();
    }
  }
}

// ================= SETUP ==============================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- [OA-NER] Left Knee Node Initializing ---");

  // I2C MPU6050
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_WHO_AM_I);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (uint8_t)1);
  uint8_t whoAmI = Wire.available() ? Wire.read() : 0x00;
  Serial.printf("MPU6050 WHO_AM_I = 0x%02X\n", whoAmI);
  if (whoAmI != 0x68) {
    Serial.println("WARNING: MPU6050 not detected, verify wiring!");
  }

  // Wake up MPU6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_PWR_MGMT_1);
  Wire.write(0x00);
  Wire.endTransmission(true);
  delay(100);

  // ADC resolution
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Wi-Fi Connection
  Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt < 8000)) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected! IP: %s\n",
                  WiFi.localIP().toString().c_str());
    Serial.printf("[UDP] Target: %s:%d\n", BACKEND_IP, BACKEND_PORT);
  } else {
    Serial.println(
        "\n[Wi-Fi] Initial connection timeout. Background reconnect active.");
  }
}

// ================= MAIN LOOP ==========================
void loop() {
  unsigned long nowMs = millis();

  // 1. Maintain Wi-Fi connectivity
  checkWiFiReconnect();

  // 2. Sample IMU @ 50Hz
  if (nowMs - lastIMU_ms >= IMU_INTERVAL_MS) {
    lastIMU_ms = nowMs;
    if (mpuReadRaw()) {
      ax_g = raw_ax / ACCEL_SCALE;
      ay_g = raw_ay / ACCEL_SCALE;
      az_g = raw_az / ACCEL_SCALE;
      gx_dps = raw_gx / GYRO_SCALE;
      gy_dps = raw_gy / GYRO_SCALE;
      gz_dps = raw_gz / GYRO_SCALE;
    }
  }

  // 3. Sample Flex Sensor @ 50Hz
  if (nowMs - lastFlex_ms >= FLEX_INTERVAL_MS) {
    lastFlex_ms = nowMs;
    flex_raw = analogRead(FLEX_PIN);
  }

  // 4. Stream UDP Contract 1 JSON @ 20Hz
  if (nowMs - lastTx_ms >= TX_INTERVAL_MS) {
    lastTx_ms = nowMs;

    // Contract 1 compliant JSON
    int len = snprintf(
        udpBuffer, sizeof(udpBuffer),
        "{\"node_id\":\"%s\",\"patient_id\":\"%s\",\"flex_resistance\":%d,"
        "\"mpu_accel\":{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f},"
        "\"mpu_gyro\":{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f}}",
        NODE_ID, PATIENT_ID, flex_raw, ax_g, ay_g, az_g, gx_dps, gy_dps,
        gz_dps);

    if (len > 0 && len < (int)sizeof(udpBuffer)) {
      udp.beginPacket(BACKEND_IP, BACKEND_PORT);
      udp.write((const uint8_t *)udpBuffer, len);
      udp.endPacket();
    }
  }
}