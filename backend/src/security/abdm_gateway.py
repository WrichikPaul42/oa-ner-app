"""
ABDM (Ayushman Bharat Digital Mission) Gateway Integration Module.

Simulates the National Health Authority (NHA) Sandbox API for:
- ABHA (Ayushman Bharat Health Account) verification & creation
- OTP/Demographic-based authentication
- Care Context linkage to Health Information Provider (HIP)
"""

import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class AbhaVerificationRequest(BaseModel):
    abha_address: str = Field(..., description="Patient ABHA Address (e.g. rahul@abdm or 91-1234-5678-9012)", examples=["sonam_ner@abdm"])
    auth_mode: str = Field(default="DEMOGRAPHICS", description="AUTH_MODE: OTP, DEMOGRAPHICS, or BIOMETRIC")


class AbhaVerificationResponse(BaseModel):
    is_valid: bool
    abha_id: str
    abha_number: Optional[str]
    patient_name: str
    gender: str
    district: str
    state: str
    consent_token: str
    message: str


def verify_and_link_abha(request: AbhaVerificationRequest) -> AbhaVerificationResponse:
    """
    Simulates ABDM Sandbox verification for frontline ASHA health workers.
    Validates formatting and returns simulated linked patient demographic context.
    """
    clean_addr = request.abha_address.strip().lower()

    if "@" not in clean_addr and len(clean_addr.replace("-", "")) != 14:
        return AbhaVerificationResponse(
            is_valid=False,
            abha_id=clean_addr,
            abha_number=None,
            patient_name="",
            gender="",
            district="",
            state="",
            consent_token="",
            message="Invalid ABHA address format. Must be username@abdm or 14-digit ABHA number."
        )

    # Simulated verified beneficiary details for North Eastern Region
    return AbhaVerificationResponse(
        is_valid=True,
        abha_id=clean_addr,
        abha_number=f"91-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}",
        patient_name="Bimla Devi",
        gender="F",
        district="East Khasi Hills",
        state="Meghalaya",
        consent_token=f"abdm-consent-{uuid.uuid4().hex[:16]}",
        message="ABHA account successfully verified and linked to Kneeva triage session."
    )
