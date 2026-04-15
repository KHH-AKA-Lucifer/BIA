from typing import Any

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    period: str = "month"


class ModelCardResponse(BaseModel):
    model_name: str
    model_type: str
    task_type: str
    scope: str
    target: str | None = None
    metrics: dict[str, Any]
    trained_at: str


class ChatResponse(BaseModel):
    answer: str
    mode: str
    route: str
    model_name: str | None = None
    model_type: str | None = None
    confidence: str | None = None
    data_scope: str | None = None
    chart_hint: str | None = None
    structured_data: Any = None
