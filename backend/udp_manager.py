import socket
import asyncio
import json
import random
from datetime import datetime, timezone
from typing import List, Dict, Any

from schemas import LiveSensorReading, Vector3D

UDP_HOST = "0.0.0.0"
UDP_PORT = 5005


def validate_contract_1(reading_dict: Dict[str, Any]) -> bool:
    """Validates if a dictionary conforms strictly to Contract 1 shape."""
    required_keys = ["node_id", "patient_id", "timestamp", "flex_resistance", "mpu_accel", "mpu_gyro"]
    if not all(k in reading_dict for k in required_keys):
        return False

    accel = reading_dict.get("mpu_accel")
    gyro = reading_dict.get("mpu_gyro")

    if not (isinstance(accel, dict) and all(axis in accel for axis in ["x", "y", "z"])):
        return False

    if not (isinstance(gyro, dict) and all(axis in gyro for axis in ["x", "y", "z"])):
        return False

    return True


class UdpSessionManager:
    """Handles raw UDP socket listening for multi-node Wi-Fi ESP32 sensors (Star Topology)."""

    def __init__(self, host: str = UDP_HOST, port: int = UDP_PORT):
        self.host = host
        self.port = port
        self.session_buffer: List[Dict[str, Any]] = []

    async def record_session(
        self,
        patient_id: str,
        duration_seconds: float = 10.0
    ) -> List[Dict[str, Any]]:
        self.session_buffer.clear()
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setblocking(False)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        try:
            sock.bind((self.host, self.port))
            loop = asyncio.get_running_loop()
            end_time = loop.time() + duration_seconds

            while loop.time() < end_time:
                remaining = end_time - loop.time()
                if remaining <= 0:
                    break
                try:
                    # FIX APPLIED HERE: Safely assign the bytes directly to 'data'
                    data = await asyncio.wait_for(
                        loop.sock_recv(sock, 4096),
                        timeout=min(0.2, max(0.01, remaining))
                    )
                    raw_str = data.decode("utf-8")
                    reading = json.loads(raw_str)
                    
                    # Attach high-precision UTC timestamp upon packet arrival if missing
                    if "timestamp" not in reading or not reading["timestamp"]:
                        reading["timestamp"] = datetime.now(timezone.utc).isoformat()

                    # Log the incoming reading to the terminal so you can see the matrix!
                    print(f"Ingested reading from {reading.get('node_id', 'unknown_node')} at {reading.get('timestamp')}")
                    
                    if validate_contract_1(reading):
                        self.session_buffer.append(reading)
                except asyncio.TimeoutError:
                    continue
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
        except Exception as e:
            print(f"[UDP] Hardware connection/listen error ({e}). Falling back to simulated stream.")
            return await generate_simulated_stream(patient_id, duration_seconds)
        finally:
            sock.close()

        if not self.session_buffer:
            # Fallback if no packets received during duration
            print("[UDP] No packets received. Falling back to simulated stream.")
            return await generate_simulated_stream(patient_id, duration_seconds)

        return self.session_buffer


async def generate_simulated_stream(
    patient_id: str,
    duration_seconds: float = 10.0,
    sample_rate_hz: int = 10
) -> List[Dict[str, Any]]:
    """
    Generates a mock dual-node sensor stream matching Contract 1 for offline testing & prototyping.
    """
    num_samples = int(duration_seconds * sample_rate_hz)
    stream = []
    nodes = ["node_left", "node_right"]

    for i in range(num_samples):
        # Simulate knee flexion movement curve (0 to 1000 resistance)
        cycle = (i % 30) / 30.0
        base_flex = int(200 + 650 * (1.0 if cycle > 0.5 else cycle * 2))

        for node_id in nodes:
            node_offset = 20 if node_id == "node_left" else -20
            flex_resistance = max(0, min(1023, base_flex + node_offset))

            reading = LiveSensorReading(
                node_id=node_id,
                patient_id=patient_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
                flex_resistance=flex_resistance,
                mpu_accel=Vector3D(
                    x=round(0.1 + random.uniform(-0.05, 0.05), 3),
                    y=round(0.9 + random.uniform(-0.05, 0.05), 3),
                    z=round(0.0 + random.uniform(-0.02, 0.02), 3)
                ),
                mpu_gyro=Vector3D(
                    x=round(random.uniform(-1.5, 1.5), 2),
                    y=round(random.uniform(-0.5, 0.5), 2),
                    z=round(random.uniform(-0.2, 0.2), 2)
                )
            )
            stream.append(reading.model_dump())
        await asyncio.sleep(1.0 / sample_rate_hz)

    return stream