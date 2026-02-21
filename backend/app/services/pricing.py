"""Pricing service — loads seed data and provides cost calculations."""

import json
import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository import seed_pricing_if_empty

logger = logging.getLogger(__name__)

SEED_FILE = Path(__file__).parent / "pricing_seed.json"


async def initialize_pricing(session: AsyncSession) -> None:
    """Seed pricing data from the JSON file if the table is empty."""
    if not SEED_FILE.exists():
        logger.warning("Pricing seed file not found: %s", SEED_FILE)
        return

    with open(SEED_FILE) as f:
        seed_data = json.load(f)

    count = await seed_pricing_if_empty(session, seed_data)
    if count > 0:
        logger.info("Seeded %d pricing models from %s", count, SEED_FILE)


def calculate_cost(
    input_tokens: int,
    output_tokens: int,
    input_per_million: float,
    output_per_million: float,
) -> dict:
    """Calculate cost breakdown for given token counts and pricing."""
    input_cost = (input_tokens / 1_000_000) * input_per_million
    output_cost = (output_tokens / 1_000_000) * output_per_million
    return {
        "input_cost": round(input_cost, 6),
        "output_cost": round(output_cost, 6),
        "total_cost": round(input_cost + output_cost, 6),
    }
