/*
  OA-NER Screening App — Production ESP32 Sensor Firmware (Wi-Fi UDP Star
  Topology) Target Device: ESP32 Dev Module Libraries Required:
    - ArduinoJson (v6+)
    - Adafruit MPU6050
    - Adafruit Unified Sensor
    - Wire & WiFi (Built-in)

  Description: Reads flex sensor with EMA filtering and MPU-6050
  accelerometer/gyroscope, formats readings into Contract 1 JSON (optimized
  memory layout, no timestamp), and streams to Python backend via UDP (port
  5005) non-blockingly at 10Hz.
*/

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <Wire.h>

// --- 1. NODE IDENTIFIER & PATIENT ID ---
#define NODE_ID "node_left"
#define PATIENT_ID "pat-active"

// --- 2. WI-FI NETWORK CREDENTIALS ---
const char *ssid = "PAUL42";
const char *password = "wric42@@";

// --- 3. BACKEND SERVER CONFIGURATION ---
const char *backendIP =
    "10.104.28.241";      // Host IP address running Python backend
const int udpPort = 5005; // UDP Star Topology listening port

// --- 4. HARDWARE & SIGNAL FILTERING ---
#define FLEX_PIN 34
const float EMA_ALPHA = 0.2f; // EMA filter smoothing factor
float flexFiltered = 0.0f;
bool isFlexInitialized = false;

Adafruit_MPU6050 mpu;
bool mpuAvailable = false;

WiFiUDP udp;

// --- 5. NON-BLOCKING TIMERS ---
unsigned long lastTxTime = 0;
const unsigned long TX_INTERVAL_MS = 100; // 10Hz = 100ms interval

unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL_MS =
    5000; // Retry Wi-Fi reconnect every 5s

// --- 6. MEMORY & PAYLOAD OPTIMIZATION ---
// Static JSON document initialized once to avoid dynamic heap re-allocations
StaticJsonDocument<256> doc;
JsonObject accelObj;
JsonObject gyroObj;

void initJsonPayload() {
  doc.clear();
  doc["node_id"] = NODE_ID;
  doc["patient_id"] = PATIENT_ID;

  accelObj = doc.createNestedObject("mpu_accel");
  accelObj["x"] = 0.0;
  accelObj["y"] = 0.0;
  accelObj["z"] = 0.0;

  gyroObj = doc.createNestedObject("mpu_gyro");
  gyroObj["x"] = 0.0;
  gyroObj["y"] = 0.0;
  gyroObj["z"] = 0.0;
}

void setup() {
  Serial.begin(115200);
  pinMode(FLEX_PIN, INPUT);

  // Initialize I2C and MPU6050 sensor
  Wire.begin();
  if (mpu.begin()) {
    mpuAvailable = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 IMU initialized successfully.");
  } else {
    Serial.println(
        "WARNING: MPU6050 not detected over I2C! Using fallback zero vectors.");
  }

  // Initial read for flex sensor EMA baseline
  flexFiltered = analogRead(FLEX_PIN);
  isFlexInitialized = true;

  // Initialize persistent JSON document structure
  initJsonPayload();

  // Connect to Wi-Fi network
  Serial.print("Connecting to Wi-Fi network: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected successfully!");
    Serial.print("ESP32 Local IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi initial connection timeout. Non-blocking reconnect "
                   "loop active.");
  }
}

void handleWiFiReconnect() {
  unsigned long currentMillis = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
      lastReconnectAttempt = currentMillis;
      Serial.println(
          "[Wi-Fi] Connection lost. Attempting non-blocking reconnect...");
      WiFi.disconnect();
      WiFi.reconnect();
    }
  }
}

void loop() {
  // 1. Maintain Wi-Fi connectivity without blocking
  handleWiFiReconnect();

  // 2. Non-blocking 10Hz (100ms) telemetry transmission loop
  unsigned long currentMillis = millis();
  if (currentMillis - lastTxTime >= TX_INTERVAL_MS) {
    lastTxTime = currentMillis;

    // --- Signal Processing: Exponential Moving Average (EMA) on ADC ---
    int rawFlex = analogRead(FLEX_PIN);
    flexFiltered = (EMA_ALPHA * rawFlex) + ((1.0f - EMA_ALPHA) * flexFiltered);
    int flexValue = (int)round(flexFiltered);

    // --- Read Live MPU6050 Accelerometer & Gyroscope Data ---
    float ax = 0.0f, ay = 0.0f, az = 0.0f;
    float gx = 0.0f, gy = 0.0f, gz = 0.0f;

    if (mpuAvailable) {
      sensors_event_t a, g, temp;
      mpu.getEvent(&a, &g, &temp);
      ax = a.acceleration.x;
      ay = a.acceleration.y;
      az = a.acceleration.z;
      gx = g.gyro.x;
      gy = g.gyro.y;
      gz = g.gyro.z;
    }

    // --- Update Dynamic Json Fields ---
    doc["flex_resistance"] = flexValue;

    accelObj["x"] = round(ax * 1000.0f) / 1000.0f;
    accelObj["y"] = round(ay * 1000.0f) / 1000.0f;
    accelObj["z"] = round(az * 1000.0f) / 1000.0f;

    gyroObj["x"] = round(gx * 1000.0f) / 1000.0f;
    gyroObj["y"] = round(gy * 1000.0f) / 1000.0f;
    gyroObj["z"] = round(gz * 1000.0f) / 1000.0f;

    // --- Transmit Payload over UDP ---
    if (WiFi.status() == WL_CONNECTED) {
      char buffer[256];
      size_t len = serializeJson(doc, buffer);

      udp.beginPacket(backendIP, udpPort);
      udp.write((const uint8_t *)buffer, len);
      udp.endPacket();

      // Optional serial debugging output
      // Serial.println(buffer);
    }
  }
}