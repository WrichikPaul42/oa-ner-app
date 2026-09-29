import socket
import asyncio
import json
import random
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

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


class KneevaLiveDatagramProtocol(asyncio.DatagramProtocol):
    """Asyncio Datagram protocol to receive continuous ESP32 UDP packets."""

    def __init__(self, hub: "LiveSensorHub"):
        self.hub = hub
        self.transport: Optional[asyncio.DatagramTransport] = None

    def connection_made(self, transport: asyncio.DatagramTransport):
        self.transport = transport

    def datagram_received(self, data: bytes, addr):
        try:
            raw_str = data.decode("utf-8", errors="ignore")
            payload = json.loads(raw_str)
            self.hub.ingest(payload, source_ip=addr[0])
        except Exception:
            pass


class LiveSensorHub:
    """Manages continuous in-memory live sensor stream from ESP32 nodes."""

    def __init__(self, host: str = UDP_HOST, port: int = UDP_PORT):
        self.host = host
        self.port = port
        self.transport: Optional[asyncio.DatagramTransport] = None
        self.latest_left: Optional[Dict[str, Any]] = None
        self.latest_right: Optional[Dict[str, Any]] = None
        self.last_left_ts: float = 0.0
        self.last_right_ts: float = 0.0
        self.packet_count: int = 0

    async def start(self) -> Optional[asyncio.DatagramTransport]:
        loop = asyncio.get_running_loop()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setblocking(False)
            sock.bind((self.host, self.port))
            transport, _ = await loop.create_datagram_endpoint(
                lambda: KneevaLiveDatagramProtocol(self),
                sock=sock
            )
            self.transport = transport
            print(f"[UDP Hub] Continuous hardware listener online on {self.host}:{self.port}")
            return transport
        except Exception as e:
            print(f"[UDP Hub] Could not bind UDP socket on {self.host}:{self.port} ({e}). Check if another process is using port 5005.")
            return None

    def stop(self):
        if self.transport:
            self.transport.close()
            self.transport = None

    def ingest(self, payload: Dict[str, Any], source_ip: str = "127.0.0.1"):
        node_id = payload.get("node_id")
        now_ts = time.time()
        if not payload.get("timestamp"):
            payload["timestamp"] = datetime.now(timezone.utc).isoformat()
        payload["_source_ip"] = source_ip

        if node_id == "node_left":
            self.latest_left = payload
            self.last_left_ts = now_ts
            self.packet_count += 1
            if self.packet_count % 10 == 1:
                print(f"[UDP Hub Live] {node_id} @ {source_ip} | Flex={payload.get('flex_resistance')} | Accel={payload.get('mpu_accel')}")
        elif node_id == "node_right":
            self.latest_right = payload
            self.last_right_ts = now_ts
            self.packet_count += 1
            if self.packet_count % 10 == 1:
                print(f"[UDP Hub Live] {node_id} @ {source_ip} | Flex={payload.get('flex_resistance')} | EMG={payload.get('emg_mv')}mV | Piezo={payload.get('piezo_peak')}")

    def get_live_payload(self) -> Dict[str, Any]:
        now_ts = time.time()
        # Active if a packet was received within the last 3.5 seconds
        left_active = (now_ts - self.last_left_ts) < 3.5 if self.latest_left else False
        right_active = (now_ts - self.last_right_ts) < 3.5 if self.latest_right else False

        return {
            "node_left": self.latest_left if left_active else None,
            "node_right": self.latest_right if right_active else None,
            "hardware_connected": left_active or right_active,
            "packet_count": self.packet_count,
            "server_time": datetime.now(timezone.utc).isoformat()
        }


live_sensor_hub = LiveSensorHub()


class UdpSessionManager:
    """Handles session recording from live buffer or direct stream."""

    def __init__(self, hub: LiveSensorHub = live_sensor_hub):
        self.hub = hub
        self.session_buffer: List[Dict[str, Any]] = []

    async def record_session(
        self,
        patient_id: str,
        duration_seconds: float = 10.0
    ) -> List[Dict[str, Any]]:
        self.session_buffer.clear()
        start_time = time.time()
        end_time = start_time + duration_seconds

        while time.time() < end_time:
            now_ts = time.time()
            if self.hub.latest_left and (now_ts - self.hub.last_left_ts) < 1.0:
                self.session_buffer.append(dict(self.hub.latest_left))
            if self.hub.latest_right and (now_ts - self.hub.last_right_ts) < 1.0:
                self.session_buffer.append(dict(self.hub.latest_right))
            await asyncio.sleep(0.05)

        if not self.session_buffer:
            print("[UDP] No live hardware packets received during window. Falling back to simulated stream.")
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