from __future__ import annotations

from typing import Protocol


class ProviderError(Exception):
    """Raised when the try-on provider fails to produce a result."""


class VTONProvider(Protocol):
    async def try_on(
        self,
        *,
        person_bytes: bytes,
        person_content_type: str,
        garment_bytes: bytes,
        garment_content_type: str,
    ) -> str:
        """Run try-on and return a URL to the result image."""
        ...
