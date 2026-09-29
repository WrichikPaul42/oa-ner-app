"""
Quick Wi-Fi UDP Test Monitor for Dual ESP32 Knee Sensor Nodes.

Listens on UDP 0.0.0.0:5005 and prints incoming packets from both:
  - node_left  (Standard ESP32: IMU + Flex)
  - node_right (XIAO ESP32-S3:  IMU + Flex + Piezo + EMG)
"""

import socket
import json
import time
import threading
import sys
import os
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import local database functions so the bridge can serve real SQLite patient records
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from database import get_db_connection, list_patients, get_patient_by_id, save_patient
    from schemas import PatientCreateRequest
    HAS_DB = True
except Exception as e:
    HAS_DB = False
    print(f" [HTTP Bridge DB Warning] Could not load database module: {e}")

UDP_IP = "0.0.0.0"
UDP_PORT = 5005
HTTP_PORT = 8000

latest_telemetry = {
    "node_left": None,
    "node_right": None,
    "last_updated": None
}

class TelemetryHttpHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0].rstrip("/")

        if clean_path.startswith("/api/sensors/live"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(latest_telemetry).encode("utf-8"))
        elif clean_path in ("/health", "/healthz", "/api/health", "/api/healthz"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "service": "kneeva_udp_bridge"}).encode("utf-8"))
        elif clean_path in ("/api/patients", "/patients") or clean_path.startswith("/api/patients/") or clean_path.startswith("/patients/"):
            parts = [p for p in clean_path.split("/") if p and p != "api"]
            # parts will be ["patients"] or ["patients", "<patient_id>"]
            patient_id = parts[1] if len(parts) > 1 else None

            if HAS_DB:
                conn = get_db_connection()
                try:
                    if patient_id:
                        p = get_patient_by_id(conn, patient_id)
                        if p:
                            data = p.model_dump() if hasattr(p, 'model_dump') else p.dict()
                            self.send_response(200)
                            self.send_header("Content-Type", "application/json")
                            self.send_header("Access-Control-Allow-Origin", "*")
                            self.end_headers()
                            self.wfile.write(json.dumps(data).encode("utf-8"))
                        else:
                            self.send_response(404)
                            self.send_header("Access-Control-Allow-Origin", "*")
                            self.end_headers()
                    else:
                        patients = list_patients(conn)
                        data = [p.model_dump() if hasattr(p, 'model_dump') else p.dict() for p in patients]
                        self.send_response(200)
                        self.send_header("Content-Type", "application/json")
                        self.send_header("Access-Control-Allow-Origin", "*")
                        self.end_headers()
                        self.wfile.write(json.dumps(data).encode("utf-8"))
                finally:
                    conn.close()
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps([]).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(post_data.decode("utf-8"))
        except Exception:
            payload = {}

        if "/abdm/link-report" in self.path:
            resp = {
                "success": True,
                "patient_id": payload.get("patient_id", "PT-10045"),
                "abha_id": payload.get("abha_id", "91-4521-8890-3412"),
                "reference_id": f"AB-LINK-{int(time.time()) % 1000000:06d}",
                "status": "LINKED_TO_ABDM_HEALTH_LOCKER",
                "message": "Report successfully synced to Ayushman Bharat Digital Mission (ABHA)."
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))
        elif "/patients" in self.path and HAS_DB:
            conn = get_db_connection()
            try:
                req = PatientCreateRequest(**payload)
                p = save_patient(conn, req)
                data = p.model_dump() if hasattr(p, 'model_dump') else p.dict()
                self.send_response(201)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            finally:
                conn.close()
        else:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode("utf-8"))

    def log_message(self, format, *args):
        # Suppress spamming console with HTTP polling logs
        pass

def start_http_server():
    try:
        server = HTTPServer(("0.0.0.0", HTTP_PORT), TelemetryHttpHandler)
        print(f" [HTTP Bridge] Live telemetry & Patient HTTP server listening on http://0.0.0.0:{HTTP_PORT}")
        server.serve_forever()
    except Exception as e:
        print(f" [HTTP Bridge Warning] Could not start HTTP server on port {HTTP_PORT}: {e}")

def main():
    # Start HTTP server thread for mobile phone bridge
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_IP, UDP_PORT))
    
    print("=" * 70)
    print(f" Kneeva Dual-ESP32 UDP Receiver Listening on {UDP_IP}:{UDP_PORT}")
    print(f" Mobile Phone Bridge Active on http://0.0.0.0:{HTTP_PORT}/api/sensors/live")
    print(" Waiting for packets from 'node_left' and 'node_right'...")
    print(" Press Ctrl+C to stop.")
    print("=" * 70)

    counts = {"node_left": 0, "node_right": 0, "other": 0}
    last_print = time.time()

    try:
        while True:
            data, addr = sock.recvfrom(2048)
            now_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            try:
                payload = json.loads(data.decode("utf-8"))
                node_id = payload.get("node_id", "unknown")
                if node_id in counts:
                    counts[node_id] += 1
                else:
                    counts["other"] += 1

                if node_id in ("node_left", "node_right"):
                    latest_telemetry[node_id] = payload
                    latest_telemetry["last_updated"] = datetime.now().isoformat()

                accel = payload.get("mpu_accel", {})
                gyro = payload.get("mpu_gyro", {})
                flex = payload.get("flex_resistance", 0)

                if node_id == "node_right":
                    piezo_peak = payload.get("piezo_peak", 0)
                    piezo_evt = payload.get("piezo_event", 0)
                    emg_mv = payload.get("emg_mv", 0.0)
                    emg_act = payload.get("emg_active", 0)
                    print(
                        f"[{now_str}] [{node_id} @ {addr[0]}] "
                        f"Flex={flex:4d} | Accel=({accel.get('x',0):.2f}, {accel.get('y',0):.2f}, {accel.get('z',0):.2f}) | "
                        f"PiezoPeak={piezo_peak:3d} (Evt={piezo_evt}) | EMG={emg_mv:5.1f}mV (Act={emg_act})"
                    )
                else:
                    print(
                        f"[{now_str}] [{node_id} @ {addr[0]}] "
                        f"Flex={flex:4d} | Accel=({accel.get('x',0):.2f}, {accel.get('y',0):.2f}, {accel.get('z',0):.2f}) | "
                        f"Gyro=({gyro.get('x',0):.1f}, {gyro.get('y',0):.1f}, {gyro.get('z',0):.1f})"
                    )

            except Exception as e:
                print(f"[{now_str}] Raw from {addr}: {data[:60]}... (Error: {e})")

    except KeyboardInterrupt:
        print("\nReceiver stopped.")
        print(f"Packet totals: Left={counts['node_left']}, Right={counts['node_right']}, Other={counts['other']}")
    finally:
        sock.close()

if __name__ == "__main__":
    main()
