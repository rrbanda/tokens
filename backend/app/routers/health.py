import logging

from fastapi import APIRouter, Depends, HTTPException
import httpx

from app.config import get_config
from app.connectors import get_connector
from app.middleware.auth import require_api_key
from app.utils.url_validator import validate_server_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["health"])

TIMEOUT = httpx.Timeout(10.0, connect=5.0)


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/deep", dependencies=[Depends(require_api_key)])
async def deep_health():
    """Check connectivity to the configured optimizer LLM server."""
    cfg = get_config()
    checks: dict = {"status": "ok", "optimizer": {"configured": False}}

    if cfg.optimizer.server_url:
        checks["optimizer"]["configured"] = True
        try:
            ssl = cfg.security.ssl_verify
            async with httpx.AsyncClient(verify=ssl, timeout=TIMEOUT) as client:
                resp = await client.get(f"{cfg.optimizer.server_url}/v1/health")
                checks["optimizer"]["healthy"] = resp.status_code < 500
                checks["optimizer"]["status_code"] = resp.status_code
        except Exception as e:
            logger.warning("Deep health check failed for optimizer: %s", e)
            checks["optimizer"]["healthy"] = False
            checks["status"] = "degraded"

    return checks


@router.get("/health/server", dependencies=[Depends(require_api_key)])
async def server_health(url: str):
    error = validate_server_url(url)
    if error:
        raise HTTPException(status_code=400, detail=error)
    connector = get_connector()
    return await connector.check_health(url)
