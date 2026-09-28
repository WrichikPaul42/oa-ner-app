"""
Kneeva Internal AI Inference Service (Black-Box Container).

Implements strict multi-layer defense boundaries:
1. VPC Private IP Subnet & Hostname verification to ensure requests strictly originate from internal VPC networks.
2. X-Internal-Auth header authentication enforcing 64-character hex shared secret matching.
"""

import sys
import os
import ipaddress
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Header, Request, status
from pydantic import BaseModel, Field

# Ensure src modules are resolvable
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.models.fusion import fusion_model

logger = logging.getLogger("kneeva.inference")

app = FastAPI(
    title="Kneeva Internal Black-Box Inference Engine",
    description="Internal microservice for CatBoost model execution within private VPC",
    version="1.2.0"
)

# 64-character hex shared secret key for internal service-to-service authentication
SHARED_SECRET = os.getenv(
    "INFERENCE_SHARED_SECRET",
    "8f9a2c4e6b1d3f5a7e9c0b2d4f6a8e1c3b5d7f9a2c4e6b1d3f5a7e9c0b2d4f6a"
)

# Authorized Private Subnets (Docker / Render VPC internal networks)
ALLOWED_VPC_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
]

def verify_internal_vpc_ip(client_host: str) -> None:
    """
    Validates that incoming HTTP request originates from inside private VPC network.
    Rejects external public IP connections and unauthorized domain names.
    """
    if not client_host:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Unable to resolve client network host."
        )

    # Allow local development & internal test harnesses
    if client_host in ("localhost", "127.0.0.1", "testclient"):
        return

    try:
        ip = ipaddress.ip_address(client_host)
        is_allowed = any(ip in network for network in ALLOWED_VPC_NETWORKS)
        if not is_allowed:
            logger.warning(f"BLOCKED external connection attempt to inference engine from IP: {client_host}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: IP address {client_host} is outside internal VPC subnet boundary."
            )
    except ValueError:
        # Hostname resolution check for cloud internal subdomains (e.g. *.internal / *.render.internal)
        if not (client_host.endswith(".internal") or client_host.endswith(".local")):
            logger.warning(f"BLOCKED external connection attempt from hostname: {client_host}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Hostname {client_host} is not in authorized private VPC domain."
            )


class InferPayload(BaseModel):
    tier_a: Dict[str, Any] = Field(..., description="Tier A patient survey features")
    tier_b: Dict[str, Any] = Field(..., description="Tier B biomechanical sensor features")
    tier_c: Dict[str, Any] = Field(..., description="Tier C Indian contextual load features")


class InferResponse(BaseModel):
    risk_score: float
    risk_category: str
    confidence_interval: List[float]
    urgency: str
    model_version: str


@app.post(
    "/infer",
    response_model=InferResponse,
    status_code=status.HTTP_200_OK,
    summary="Isolated Black-Box CatBoost Inference Route"
)
async def infer_route(
    request: Request,
    payload: InferPayload,
    x_internal_auth: Optional[str] = Header(None, alias="X-Internal-Auth")
) -> InferResponse:
    """
    Executes CatBoost model prediction behind two isolation boundaries:
    1. Private VPC IP Subnet / Hostname restriction.
    2. Shared 64-char hex secret validation (X-Internal-Auth).
    """
    client_host = request.client.host if request.client else "127.0.0.1"

    # 1. Enforce VPC IP-range boundary check
    verify_internal_vpc_ip(client_host)

    # 2. Enforce Shared Secret X-Internal-Auth header check
    if not x_internal_auth or x_internal_auth != SHARED_SECRET:
        logger.warning(f"UNAUTHORIZED: Invalid or missing X-Internal-Auth key from IP {client_host}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing or invalid X-Internal-Auth shared secret header."
        )

    # Execute CatBoost Multimodal Fusion Model
    score, category, ci, urgency = fusion_model.predict(
        tier_a=payload.tier_a,
        tier_b=payload.tier_b,
        tier_c=payload.tier_c
    )

    return InferResponse(
        risk_score=score,
        risk_category=category,
        confidence_interval=ci,
        urgency=urgency,
        model_version=fusion_model.model_version
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
