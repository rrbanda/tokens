import logging

from fastapi import APIRouter, Depends, HTTPException

from app.connectors import get_connector
from app.middleware.auth import require_api_key
from app.models.schemas import DiscoverRequest, DiscoverResponse
from app.utils.url_validator import validate_server_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["discover"], dependencies=[Depends(require_api_key)])


@router.post("/discover", response_model=DiscoverResponse)
async def discover(req: DiscoverRequest):
    """Validate a server URL and discover its available models and tools."""
    error = validate_server_url(req.server_url)
    if error:
        raise HTTPException(status_code=400, detail=error)

    connector = get_connector(req.provider)

    health = await connector.check_health(req.server_url)

    if not health.get("healthy", False):
        return DiscoverResponse(
            server_url=req.server_url,
            healthy=False,
            status=health.get("status", "unreachable"),
            error=health.get("error"),
        )

    models = await connector.discover_models(req.server_url)
    tools = await connector.discover_tools(req.server_url)

    return DiscoverResponse(
        server_url=req.server_url,
        healthy=True,
        status=health.get("status", "ok"),
        models=models,
        tools=tools,
    )
