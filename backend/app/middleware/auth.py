import logging

from fastapi import Request, HTTPException

from app.config import get_config

logger = logging.getLogger(__name__)


async def require_api_key(request: Request) -> None:
    """FastAPI dependency that enforces API key auth when configured."""
    api_key = get_config().security.api_key
    if not api_key:
        return

    provided = request.headers.get("X-API-Key", "")
    if provided != api_key:
        logger.warning("Unauthorized request from %s to %s", request.client.host if request.client else "unknown", request.url.path)
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
