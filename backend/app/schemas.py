from pydantic import BaseModel


class TryOnResponse(BaseModel):
    result_url: str


class HealthResponse(BaseModel):
    status: str = "ok"
