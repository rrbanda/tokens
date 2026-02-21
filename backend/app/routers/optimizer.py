import logging

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.middleware.auth import require_api_key
from app.models.schemas import OptimizationRequest, OptimizationResponse
from app.services.analyzer import analyze

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["optimizer"], dependencies=[Depends(require_api_key)])
limiter = Limiter(key_func=get_remote_address)


@router.post("/optimize", response_model=OptimizationResponse)
@limiter.limit("5/minute")
async def optimize(request: Request, req: OptimizationRequest):
    """Analyze benchmark results and generate optimization suggestions."""
    return await analyze(req)
