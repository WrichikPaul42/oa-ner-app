"""
Kneeva Dual-ESP32 UDP Receiver & Live App Bridge.

1. Listens on UDP 0.0.0.0:5005 for incoming ESP32 packets.
2. Prints formatted live telemetry to terminal.
3. Hosts a lightweight HTTP server on 0.0.0.0:8000 serving GET /api/sensors/live
   with CORS enabled, streaming live hardware data directly into the React Native app.
"""

import socket
import json
import time
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

UDP_IP = "0.0.0.0"
UDP_PORT = 5005
HTTP_PORT = 8000

# Global latest sensor readings
LATEST = {
    "node_left": None,
    "node_right": None,
    "last_left_ts": 0.0,
    "last_right_ts": 0.0,
}


class LiveStreamHTTPHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        now = time.time()
        left_active = (now - LATEST["last_left_ts"]) < 3.5 if LATEST["node_left"] else False
        right_active = (now - LATEST["last_right_ts"]) < 3.5 if LATEST["node_right"] else False

        resp = {
            "node_left": LATEST["node_left"] if left_active else None,
            "node_right": LATEST["node_right"] if right_active else None,
            "hardware_connected": left_active or right_active,
            "timestamp": datetime.now().isoformat()
        }
        self.wfile.write(json.dumps(resp).encode("utf-8"))

    def log_message(self, format, *args):
        # Suppress noisy HTTP request logs so UDP terminal stream stays clean
        pass


def run_http_server():
    try:
        server = HTTPServer(("0.0.0.0", HTTP_PORT), LiveStreamHTTPHandler)
        server.serve_forever()
    except Exception as e:
        print(f"[HTTP Server Warning] Port {HTTP_PORT} busy or unavailable ({e}).")


def main():
    # Start background HTTP bridge for React Native App
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_IP, UDP_PORT))

    print("=" * 75)
    print(f" Kneeva Dual-ESP32 Receiver & Mobile App Bridge ONLINE")
    print(f" UDP Listening on  : {UDP_IP}:{UDP_PORT}")
    print(f" App HTTP Stream on: http://0.0.0.0:{HTTP_PORT}/api/sensors/live")
    print("=" * 75)

    counts = {"node_left": 0, "node_right": 0, "other": 0}

    try:
        while True:
            data, addr = sock.recvfrom(2048)
            now_ts = time.time()
            now_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            try:
                payload = json.loads(data.decode("utf-8", errors="ignore"))
                node_id = payload.get("node_id", "unknown")

                if node_id == "node_left":
                    counts["node_left"] += 1
                    LATEST["node_left"] = payload
                    LATEST["last_left_ts"] = now_ts
                elif node_id == "node_right":
                    counts["node_right"] += 1
                    LATEST["node_right"] = payload
                    LATEST["last_right_ts"] = now_ts
                else:
                    counts["other"] += 1

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
                        f"PiezoPeak={piezo_peak:4d} (Evt={piezo_evt}) | EMG={emg_mv:5.1f}mV (Act={emg_act}) -> [FORWARDED TO APP]"
                    )
                else:
                    print(
                        f"[{now_str}] [{node_id} @ {addr[0]}] "
                        f"Flex={flex:4d} | Accel=({accel.get('x',0):.2f}, {accel.get('y',0):.2f}, {accel.get('z',0):.2f}) | "
                        f"Gyro=({gyro.get('x',0):.1f}, {gyro.get('y',0):.1f}, {gyro.get('z',0):.1f}) -> [FORWARDED TO APP]"
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

