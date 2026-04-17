from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings


SYSTEM_PROMPT = """You are a business intelligence assistant for a vending analytics dashboard.
Answer only from the supplied structured context.
Use the matched entity details and request_scope first, then rankings and aggregate summaries.
Do not invent data, models, metrics, dates, causes, or business rules.
If the context is insufficient, say that clearly and state what is missing.
If a prediction model was not supplied in context, do not imply trained predictive modeling.
If the user asks for a recommendation, base it strictly on the supplied evidence and label it as an analytical recommendation, not certainty.
Never answer from general world knowledge when the question is about this dashboard.
Keep answers concise, analytical, and presentation-ready.
Preferred structure:
1. Direct answer in 1-3 sentences.
2. 2-4 evidence points from the supplied context.
3. One short limitation note only if needed."""


def _post_json(url: str, payload: dict[str, object], api_key: str) -> dict[str, object]:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urlopen(request, timeout=settings.LLM_REQUEST_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _extract_content(payload: dict[str, object]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return str(message.get("content") or "").strip()


def generate_context_bound_answer(question: str, context: dict[str, object]) -> dict[str, str] | None:
    user_prompt = (
        f"Question:\n{question}\n\n"
        "Use only this JSON context. If it does not contain enough evidence, say so.\n\n"
        f"Context JSON:\n{json.dumps(context, default=str)}"
    )
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 500,
    }

    if settings.OPENAI_API_KEY:
        try:
            response = _post_json(
                "https://api.openai.com/v1/chat/completions",
                payload,
                settings.OPENAI_API_KEY,
            )
            content = _extract_content(response)
            if content:
                return {"provider": "openai", "model": settings.OPENAI_MODEL, "answer": content}
        except (HTTPError, URLError, TimeoutError, ValueError):
            pass

    if settings.GROQ_API_KEY:
        groq_payload = {**payload, "model": settings.GROQ_MODEL}
        try:
            response = _post_json(
                "https://api.groq.com/openai/v1/chat/completions",
                groq_payload,
                settings.GROQ_API_KEY,
            )
            content = _extract_content(response)
            if content:
                return {"provider": "groq", "model": settings.GROQ_MODEL, "answer": content}
        except (HTTPError, URLError, TimeoutError, ValueError):
            return None

    return None
