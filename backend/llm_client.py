"""Shared Groq client with configured-model fallback."""

import logging
from typing import Any

from groq import Groq

from config import settings

logger = logging.getLogger(__name__)


def _is_model_access_error(error: Exception) -> bool:
    status_code = getattr(error, "status_code", None)
    message = str(error).lower()
    return status_code in {401, 403, 404} or any(
        marker in message
        for marker in ("model", "permission", "access", "not found", "unauthorized")
    )


def create_chat_completion(**kwargs: Any) -> tuple[Any, str]:
    """Call the configured model and retry once with the configured fallback."""
    primary_model = settings.GROQ_MODEL
    fallback_model = settings.GROQ_FALLBACK_MODEL
    client = Groq(api_key=settings.GROQ_API_KEY)
    try:
        return client.chat.completions.create(model=primary_model, **kwargs), primary_model
    except Exception as primary_error:
        if not _is_model_access_error(primary_error) or fallback_model == primary_model:
            raise
        logger.info(
            "Groq model '%s' not accessible (%s); falling back to '%s'",
            primary_model,
            type(primary_error).__name__,
            fallback_model,
        )
        try:
            return client.chat.completions.create(model=fallback_model, **kwargs), fallback_model
        except Exception:
            logger.error("Groq fallback model %s also failed", fallback_model)
            raise
