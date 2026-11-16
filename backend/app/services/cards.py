"""Card numbers that sellers, porters and taxi drivers give so customers can pay them directly."""
import re
from typing import Optional
from fastapi import HTTPException


def clean_card(text: str) -> Optional[str]:
    """Keeps the digits in groups of four; empty removes the card."""
    digits = re.sub(r"\D", "", text or "")
    if not digits:
        return None
    if not 16 <= len(digits) <= 19:
        raise HTTPException(status_code=400, detail="Karta raqami 16 ta raqamdan iborat bo'lishi kerak / Номер карты должен содержать 16 цифр")
    return " ".join(digits[i:i + 4] for i in range(0, len(digits), 4))
