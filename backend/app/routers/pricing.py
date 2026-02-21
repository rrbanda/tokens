"""Pricing management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_session
from app.db.repository import delete_custom_pricing, get_all_pricing, upsert_pricing
from app.middleware.auth import require_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["pricing"])


class CustomPricingRequest(BaseModel):
    provider: str
    model_id: str
    display_name: str
    input_per_million: float
    output_per_million: float


class CostCalculationRequest(BaseModel):
    input_tokens: int
    output_tokens: int
    model_id: str
    provider: str = ""


def _pricing_to_dict(p) -> dict:
    return {
        "id": p.id,
        "provider": p.provider,
        "model_id": p.model_id,
        "display_name": p.display_name,
        "input_per_million": p.input_per_million,
        "output_per_million": p.output_per_million,
        "is_custom": p.is_custom,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/pricing")
async def get_pricing(session: AsyncSession = Depends(get_session)):
    """Get all pricing data (built-in + custom)."""
    models = await get_all_pricing(session)
    providers: dict[str, list[dict]] = {}
    for m in models:
        providers.setdefault(m.provider, []).append(_pricing_to_dict(m))
    return {"providers": providers, "total": len(models)}


@router.post("/pricing/custom", dependencies=[Depends(require_api_key)])
async def add_custom_pricing(req: CustomPricingRequest, session: AsyncSession = Depends(get_session)):
    """Add or update custom pricing for a model."""
    pricing_id = await upsert_pricing(
        session,
        provider=req.provider,
        model_id=req.model_id,
        display_name=req.display_name,
        input_per_million=req.input_per_million,
        output_per_million=req.output_per_million,
        is_custom=True,
    )
    return {"id": pricing_id}


@router.delete("/pricing/custom/{pricing_id}", dependencies=[Depends(require_api_key)])
async def remove_custom_pricing(pricing_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a custom pricing entry."""
    deleted = await delete_custom_pricing(session, pricing_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Custom pricing entry not found")
    return {"deleted": True}


@router.post("/pricing/calculate")
async def calculate_cost(req: CostCalculationRequest, session: AsyncSession = Depends(get_session)):
    """Calculate cost for a given token count and model."""
    from sqlalchemy import select
    from app.db.models import PricingModel

    query = select(PricingModel).where(PricingModel.model_id == req.model_id)
    if req.provider:
        query = query.where(PricingModel.provider == req.provider)

    result = await session.execute(query)
    pm = result.scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=404, detail=f"No pricing found for model '{req.model_id}'")

    input_cost = (req.input_tokens / 1_000_000) * pm.input_per_million
    output_cost = (req.output_tokens / 1_000_000) * pm.output_per_million
    return {
        "input_cost": round(input_cost, 6),
        "output_cost": round(output_cost, 6),
        "total_cost": round(input_cost + output_cost, 6),
        "model": _pricing_to_dict(pm),
    }
