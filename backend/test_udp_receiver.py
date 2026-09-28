"""
Quick Wi-Fi UDP Test Monitor for Dual ESP32 Knee Sensor Nodes.

Listens on UDP 0.0.0.0:5005 and prints incoming packets from both:
  - node_left  (Standard ESP32: IMU + Flex)
  - node_right (XIAO ESP32-S3:  IMU + Flex + Piezo + EMG)
"""

import socket
import json
import time
from datetime import datetime

UDP_IP = "0.0.0.0"
UDP_PORT = 5005

def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_IP, UDP_PORT))
    
    print("=" * 70)
    print(f" Kneeva Dual-ESP32 UDP Receiver Listening on {UDP_IP}:{UDP_PORT}")
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
