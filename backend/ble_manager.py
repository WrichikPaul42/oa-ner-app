"""
Deprecation/Migration notice:
The Bleak BLE connection manager has been replaced with Raw UDP over IPv4.
This file now forwards to udp_manager.py for backwards compatibility.
"""

from udp_manager import (
    validate_contract_1,
    UdpSessionManager as BleSessionManager,
    UdpSessionManager,
    generate_simulated_stream,
    UDP_HOST,
    UDP_PORT,
)

__all__ = [
    "validate_contract_1",
    "BleSessionManager",
    "UdpSessionManager",
    "generate_simulated_stream",
    "UDP_HOST",
    "UDP_PORT",
]
