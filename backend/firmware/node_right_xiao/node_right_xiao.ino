/*
  OA-NER Screening App — Right Knee Sensor Node
  Board: Seeed Studio XIAO ESP32-S3 Sense

  Wiring:
    MPU6050: VCC -> 3.3V, GND -> GND, SCL -> GPIO6 (D5), SDA -> GPIO5 (D4), AD0 -> GND
    Flex:    Divider junction -> GPIO1 (D0)
    Piezo:   AOUT -> GPIO2 (D1)
    EMG:     SIG -> 10k -> GPIO8 (D9), GPIO8 -> 10k -> GND (voltage divider)
             EMG sensor GND must connect to ESP32 GND.

  Features:
    - High-speed non-blocking sampling:
        * Piezo Crepitus: ~500Hz (every 2ms via micros())
        * EMG Envelope:   ~200Hz (every 5ms via millis())
        * IMU Kinematics: ~50Hz  (every 20ms)
        * Flex ROM:       ~50Hz  (every 20ms)
    - Wi-Fi UDP streaming directly to Kneeva backend (Star Topology, Port 5005)
    - Zero dynamic heap allocation (uses fixed static snprintf buffer)
    - Non-blocking Wi-Fi auto-reconnection
    - PLOTTER_MODE switch (1 = Serial Plotter over USB, 0 = Wi-Fi UDP Streaming)
*/

#include <WiFi.h>
#include <WiFiUdp.h>
#include <Wire.h>

// Set to 1 only when testing via Arduino IDE > Tools > Serial Plotter over USB
#define PLOTTER_MODE 0

// ================= USER CONFIGURATION =================
#define NODE_ID "node_right"
#define PATIENT_ID "pat-active"

const char *WIFI_SSID = "PAUL42"; // Replace with your Wi-Fi / Hotspot SSID
const char *WIFI_PASSWORD = "wric42@@";   // Replace with your Wi-Fi password
const char *BACKEND_IP = "192.168.137.1"; // Replace with your PC's IP address
const int BACKEND_PORT = 5005;            // UDP listening port

// ================= HARDWARE PINOUT ====================
#define SDA_PIN 5   // D4
#define SCL_PIN 6   // D5
#define FLEX_PIN 1  // D0
#define PIEZO_PIN 2 // D1
#define EMG_PIN 8   // D9

// ================= MPU6050 ============================
#define MPU_ADDR 0x68
#define REG_PWR_MGMT_1 0x6B
#define REG_ACCEL_XOUT_H 0x3B
#define REG_WHO_AM_I 0x75

const float ACCEL_SCALE = 16384.0f; // LSB/g (±2g)
const float GYRO_SCALE = 131.0f;    // LSB/(deg/s) (±250 dps)

int16_t raw_ax, raw_ay, raw_az, raw_temp, raw_gx, raw_gy, raw_gz;

// Latest kinematic values
float vAx_g = 0.0f, vAy_g = 0.0f, vAz_g = 0.0f;
float vGx = 0.0f, vGy = 0.0f, vGz = 0.0f;
bool  imuDetected = false;
int vFlexRaw = 0;

// ADC Shared Constants
const float ADC_VREF = 3.3f;
const int ADC_MAX = 4095;

// ================= PIEZO CREPITUS SENSOR ==============
int piezoBaseline = 0;
const int SPIKE_THRESHOLD = 150;
int vPiezoPeak = 0;  // Peak deviation windowed for each UDP transmit
int vPiezoEvent = 0; // 1 if spike detected during frame

// ================= EMG MUSCLE SENSOR ==================
const int EMG_SMOOTH_SAMPLES = 20;
const int EMG_CALIB_MS = 3000;
const float EMG_DIVIDER_RATIO = 2.0f; // 10k + 10k voltage divider

float emgBuffer[EMG_SMOOTH_SAMPLES];
int emgBufIndex = 0;
float emgBufSum = 0;

float emgBaseline = 0;
float emgThresholdOn = 0;
float emgThresholdOff = 0;
bool emgActive = false;
float vEmgRaw = 0, vEmgSmooth = 0;
int vEmgActive = 0;

float readEmgMv() { return analogReadMilliVolts(EMG_PIN) * EMG_DIVIDER_RATIO; }

float emgSmooth(float v) {
  emgBufSum -= emgBuffer[emgBufIndex];
  emgBuffer[emgBufIndex] = v;
  emgBufSum += v;
  emgBufIndex = (emgBufIndex + 1) % EMG_SMOOTH_SAMPLES;
  return emgBufSum / EMG_SMOOTH_SAMPLES;
}

void calibrateEmg() {
  Serial.println(
      "[EMG] Calibrating: Keep the quadriceps muscle relaxed for 3 seconds...");
  unsigned long start = millis();
  float sum = 0;
  float maxNoise = 0;
  int n = 0;

  while (millis() - start < (unsigned long)EMG_CALIB_MS) {
    sum += readEmgMv();
    n++;
    delay(5);
  }
  emgBaseline = (n > 0) ? (sum / n) : 200.0f;

  start = millis();
  while (millis() - start < 1000UL) {
    float d = fabsf(readEmgMv() - emgBaseline);
    if (d > maxNoise)
      maxNoise = d;
    delay(5);
  }

  emgThresholdOn = emgBaseline + fmaxf(150.0f, maxNoise * 3.0f);
  emgThresholdOff = emgBaseline + fmaxf(80.0f, maxNoise * 1.5f);

  for (int i = 0; i < EMG_SMOOTH_SAMPLES; i++)
    emgBuffer[i] = emgBaseline;
  emgBufSum = emgBaseline * EMG_SMOOTH_SAMPLES;

  Serial.printf(
      "[EMG] Baseline: %.0f mV | Threshold ON > %.0f mV | OFF < %.0f mV\n",
      emgBaseline, emgThresholdOn, emgThresholdOff);
}

// ================= TIMERS (NON-BLOCKING) ==============
unsigned long lastIMU_ms = 0;
unsigned long lastFlex_ms = 0;
unsigned long lastEMG_ms = 0;
unsigned long lastTx_ms = 0;
unsigned long lastReconnect_ms = 0;
unsigned long lastPiezo_us = 0;

const unsigned long IMU_INTERVAL_MS = 20;         // 50Hz
const unsigned long FLEX_INTERVAL_MS = 20;        // 50Hz
const unsigned long EMG_INTERVAL_MS = 5;          // 200Hz
const unsigned long TX_INTERVAL_MS = 50;          // 20Hz UDP transmit
const unsigned long PIEZO_INTERVAL_US = 2000;     // 500Hz
const unsigned long RECONNECT_INTERVAL_MS = 5000; // Check Wi-Fi every 5s

// ================= UDP SOCKET =========================
WiFiUDP udp;
char udpBuffer[320];

// ================= I2C MPU6050 READ ===================
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
      Serial.println("[Wi-Fi] Connection lost. Reconnecting...");
      WiFi.disconnect();
      WiFi.reconnect();
    }
  }
}

// ================= SETUP ==============================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- [OA-NER] Right Knee XIAO S3 Initializing ---");

  // I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  Wire.setTimeOut(25);

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_WHO_AM_I);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (uint8_t)1);
  uint8_t whoAmI = Wire.available() ? Wire.read() : 0x00;
  Serial.printf("MPU6050 WHO_AM_I = 0x%02X\n", whoAmI);
  if (whoAmI == 0x68 || whoAmI == 0x69 || whoAmI == 0x70 || whoAmI == 0x72) {
    imuDetected = true;
    Serial.println("[IMU] MPU6050 detected and active.");

    // Wake up MPU6050
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(REG_PWR_MGMT_1);
    Wire.write(0x00);
    Wire.endTransmission(true);
    delay(50);
  } else {
    imuDetected = false;
    Serial.println("WARNING: Unexpected WHO_AM_I, skipping I2C polling to prevent loop blocking.");
  }

  // ADC configuration
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Piezo baseline calibration
  long pSum = 0;
  for (int i = 0; i < 50; i++) {
    pSum += analogRead(PIEZO_PIN);
    delay(2);
  }
  piezoBaseline = pSum / 50;
  Serial.printf("[Piezo] Baseline raw ~ %d\n", piezoBaseline);

  // EMG baseline calibration
  calibrateEmg();

  // Wi-Fi Connection
#if !PLOTTER_MODE
  Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt < 8000)) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    udp.begin(5005);
    Serial.printf("\n[Wi-Fi] Connected! IP: %s\n",
                  WiFi.localIP().toString().c_str());
    Serial.printf("[UDP] Streaming to: %s:%d\n", BACKEND_IP, BACKEND_PORT);
  } else {
    Serial.println(
        "\n[Wi-Fi] Connection timeout. Non-blocking reconnect active.");
  }
#endif
}

// ================= MAIN LOOP ==========================
void loop() {
  unsigned long nowMs = millis();
  unsigned long nowUs = micros();

#if !PLOTTER_MODE
  // 1. Maintain Wi-Fi
  checkWiFiReconnect();
#endif

  // 2. Sample IMU @ 50Hz
  if (nowMs - lastIMU_ms >= IMU_INTERVAL_MS) {
    lastIMU_ms = nowMs;
    if (imuDetected && mpuReadRaw()) {
      vAx_g = raw_ax / ACCEL_SCALE;
      vAy_g = raw_ay / ACCEL_SCALE;
      vAz_g = raw_az / ACCEL_SCALE;
      vGx = raw_gx / GYRO_SCALE;
      vGy = raw_gy / GYRO_SCALE;
      vGz = raw_gz / GYRO_SCALE;
    }
  }

  // 3. Sample Flex Sensor @ 50Hz
  if (nowMs - lastFlex_ms >= FLEX_INTERVAL_MS) {
    lastFlex_ms = nowMs;
    vFlexRaw = analogRead(FLEX_PIN);
  }

  // 4. Sample EMG @ 200Hz
  if (nowMs - lastEMG_ms >= EMG_INTERVAL_MS) {
    lastEMG_ms = nowMs;
    vEmgRaw = readEmgMv();
    vEmgSmooth = emgSmooth(vEmgRaw);

    if (!emgActive && vEmgSmooth > emgThresholdOn)
      emgActive = true;
    if (emgActive && vEmgSmooth < emgThresholdOff)
      emgActive = false;
    vEmgActive = emgActive ? 1 : 0;
  }

  // 5. Sample Piezo @ 500Hz
  if (nowUs - lastPiezo_us >= PIEZO_INTERVAL_US) {
    lastPiezo_us = nowUs;
    int raw = analogRead(PIEZO_PIN);
    int deviation = abs(raw - piezoBaseline);
    if (deviation > vPiezoPeak)
      vPiezoPeak = deviation;
    if (deviation > SPIKE_THRESHOLD)
      vPiezoEvent = 1;
  }

#if PLOTTER_MODE
  // USB Serial Plotter Output @ 50Hz
  if (nowMs - lastTx_ms >= 20) {
    lastTx_ms = nowMs;
    Serial.printf("EMG_raw_mV:%.0f,EMG_smooth_mV:%.0f,EMG_active:%d,"
                  "Flex_raw:%d,Piezo_peak:%d,"
                  "Accel_X_g:%.2f,Accel_Y_g:%.2f,Accel_Z_g:%.2f,"
                  "Gyro_X_dps:%.1f,Gyro_Y_dps:%.1f,Gyro_Z_dps:%.1f\n",
                  vEmgRaw, vEmgSmooth, vEmgActive * 500, vFlexRaw, vPiezoPeak,
                  vAx_g, vAy_g, vAz_g, vGx, vGy, vGz);
    vPiezoPeak = 0;
    vPiezoEvent = 0;
  }
#else
  // 6. Transmit UDP Payload @ 20Hz
  if (nowMs - lastTx_ms >= TX_INTERVAL_MS) {
    lastTx_ms = nowMs;

    if (WiFi.status() == WL_CONNECTED) {
      // Contract 1 compliant JSON with enriched acoustic & neuromuscular
      // metrics
      int len = snprintf(
          udpBuffer, sizeof(udpBuffer),
          "{\"node_id\":\"%s\",\"patient_id\":\"%s\",\"flex_resistance\":%d,"
          "\"mpu_accel\":{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f},"
          "\"mpu_gyro\":{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f},"
          "\"piezo_peak\":%d,\"piezo_event\":%d,"
          "\"emg_mv\":%.1f,\"emg_active\":%d}",
          NODE_ID, PATIENT_ID, vFlexRaw, vAx_g, vAy_g, vAz_g, vGx, vGy, vGz,
          vPiezoPeak, vPiezoEvent, vEmgSmooth, vEmgActive);

      if (len > 0 && len < (int)sizeof(udpBuffer)) {
        udp.beginPacket(BACKEND_IP, BACKEND_PORT);
        udp.write((const uint8_t *)udpBuffer, len);
        udp.endPacket();
      }
    }

    // Reset windowed event counters for next frame
    vPiezoPeak = 0;
    vPiezoEvent = 0;
  }
#endif
}
