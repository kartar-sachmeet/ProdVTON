import pytest

from app.providers.base import ProviderError

# Minimal valid PNG (1x1 transparent pixel)
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae"
    "426082"
)


@pytest.fixture
def png_bytes() -> bytes:
    return PNG_BYTES


class FakeProvider:
    def __init__(self, result_url="https://fal.example/result.png", raises=False):
        self.result_url = result_url
        self.raises = raises
        self.calls = []

    async def try_on(self, *, person_bytes, person_content_type, garment_bytes, garment_content_type):
        self.calls.append((person_bytes, garment_bytes))
        if self.raises:
            raise ProviderError("boom")
        return self.result_url


@pytest.fixture
def fake_provider():
    return FakeProvider()
