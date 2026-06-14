from __future__ import annotations

import asyncio

import httpx

from app.providers.base import ProviderError

_API_BASE = "https://api.runpod.ai/v2"
_TERMINAL = {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}
_POLL_INTERVAL_SECONDS = 2.0


async def run_job(
    *,
    endpoint_id: str,
    api_key: str,
    job_input: dict,
    timeout: float,
) -> dict:
    """Submit a RunPod serverless job and poll it to completion.

    Returns the job's ``output`` dict. Raises ProviderError on misconfiguration,
    a terminal non-completed status, timeout, or transport failure.
    """
    if not endpoint_id or not api_key:
        raise ProviderError("RunPod endpoint is not configured.")

    headers = {"Authorization": f"Bearer {api_key}"}
    base = f"{_API_BASE}/{endpoint_id}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            submit = await client.post(f"{base}/run", json={"input": job_input}, headers=headers)
            submit.raise_for_status()
            job_id = submit.json()["id"]

            loop = asyncio.get_event_loop()
            deadline = loop.time() + timeout
            while True:
                resp = await client.get(f"{base}/status/{job_id}", headers=headers)
                resp.raise_for_status()
                body = resp.json()
                status = body.get("status")
                if status == "COMPLETED":
                    return body.get("output") or {}
                if status in _TERMINAL:
                    raise ProviderError(f"RunPod job {status}: {body.get('error', 'no detail')}")
                if loop.time() >= deadline:
                    raise ProviderError("RunPod job timed out before completing.")
                await asyncio.sleep(_POLL_INTERVAL_SECONDS)
    except ProviderError:
        raise
    except Exception as exc:  # noqa: BLE001 — normalize transport failures
        raise ProviderError(f"RunPod request failed: {exc}") from exc
