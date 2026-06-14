from __future__ import annotations

import httpx
from fastapi import Depends, FastAPI, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.providers.base import ProviderError, VTONProvider
from app.providers.fal_provider import FalVTONProvider
from app.providers.makeup_provider import RunPodMakeupProvider
from app.providers.runpod_provider import RunPodVTONProvider
from app.schemas import HealthResponse, TryOnResponse
from app.services import fal_proxy
from app.services.images import ImageError
from app.services.tryon import generate_tryon

app = FastAPI(title="ProdVton API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_provider() -> VTONProvider:
    settings = get_settings()
    if settings.vton_provider == "runpod":
        return RunPodVTONProvider(settings)
    return FalVTONProvider(settings)


def get_makeup_provider() -> RunPodMakeupProvider:
    return RunPodMakeupProvider(get_settings())


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.api_route(
    "/api/fal/proxy",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def fal_proxy_route(
    request: Request,
    config: Settings = Depends(get_settings),
) -> Response:
    """Proxy browser fal-SDK requests, injecting FAL_KEY server-side."""
    body = await request.body()
    async with httpx.AsyncClient(timeout=config.request_timeout_seconds) as client:
        try:
            upstream = await fal_proxy.forward(
                method=request.method,
                headers=dict(request.headers),
                body=body,
                fal_key=config.fal_key,
                client=client,
            )
        except fal_proxy.FalProxyError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=fal_proxy.response_headers(upstream),
    )


def _ensure_upload_within_limit(upload: UploadFile, *, field: str, max_bytes: int) -> None:
    """Reject an upload that declares a size over the limit, before reading it into memory."""
    if upload.size is not None and upload.size > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"{field} image exceeds maximum size of {max_bytes} bytes.",
        )


@app.post("/api/tryon", response_model=TryOnResponse)
async def tryon(
    person: UploadFile,
    garment: UploadFile | None = None,
    garment_url: str | None = Form(default=None),
    provider: VTONProvider = Depends(get_provider),
    config: Settings = Depends(get_settings),
) -> TryOnResponse:
    _ensure_upload_within_limit(person, field="Person", max_bytes=config.max_image_bytes)
    if garment is not None:
        _ensure_upload_within_limit(garment, field="Garment", max_bytes=config.max_image_bytes)

    person_bytes = await person.read()
    garment_bytes = await garment.read() if garment is not None else None

    async with httpx.AsyncClient(timeout=config.request_timeout_seconds) as http_client:
        try:
            result_url = await generate_tryon(
                provider=provider,
                person_bytes=person_bytes,
                person_content_type=person.content_type,
                garment_bytes=garment_bytes,
                garment_content_type=garment.content_type if garment else None,
                garment_url=garment_url,
                http_client=http_client,
                max_bytes=config.max_image_bytes,
                allowed_types=config.allowed_image_types,
            )
        except ImageError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return TryOnResponse(result_url=result_url)


@app.post("/api/makeup", response_model=TryOnResponse)
async def makeup(
    source: UploadFile,
    reference: UploadFile,
    intensity: float = Form(default=1.0),
    provider: RunPodMakeupProvider = Depends(get_makeup_provider),
    config: Settings = Depends(get_settings),
) -> TryOnResponse:
    """High-fidelity generative makeup transfer (Stable-Makeup via RunPod)."""
    _ensure_upload_within_limit(source, field="Source", max_bytes=config.max_image_bytes)
    _ensure_upload_within_limit(reference, field="Reference", max_bytes=config.max_image_bytes)

    source_bytes = await source.read()
    reference_bytes = await reference.read()
    try:
        result_url = await provider.transfer(
            source_bytes=source_bytes,
            reference_bytes=reference_bytes,
            intensity=intensity,
        )
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return TryOnResponse(result_url=result_url)
