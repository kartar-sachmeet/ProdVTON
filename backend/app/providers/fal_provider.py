from __future__ import annotations

from app.config import Settings


class FalVTONProvider:
    def __init__(self, settings: Settings):
        self._settings = settings

    async def try_on(
        self,
        *,
        person_bytes: bytes,
        person_content_type: str,
        garment_bytes: bytes,
        garment_content_type: str,
    ) -> str:
        raise NotImplementedError("FalVTONProvider is implemented in Task 8.")
