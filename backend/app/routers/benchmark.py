import asyncio
import logging

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_session
from app.db.repository import save_benchmark_run
from app.middleware.auth import require_api_key
from app.models.schemas import (
    AssessmentRequest,
    AssessmentResponse,
    BenchmarkRequest,
    BenchmarkResponse,
    ComparisonBenchmarkRequest,
    ComparisonBenchmarkResponse,
)
from app.services.assessor import assess
from app.services.benchmark import run_benchmark

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["benchmark"], dependencies=[Depends(require_api_key)])
limiter = Limiter(key_func=get_remote_address)


async def _persist_run(response: BenchmarkResponse, provider: str, session: AsyncSession) -> str:
    """Persist a benchmark run to the database and return its ID."""
    results_data = [
        {
            "prompt": r.prompt,
            "response_text": r.response_text,
            "input_tokens": r.usage.input_tokens,
            "output_tokens": r.usage.output_tokens,
            "total_tokens": r.usage.total_tokens,
            "latency_ms": r.latency_ms,
            "api_used": r.api_used,
            "quality_score": r.quality_score,
            "quality_reasoning": r.quality_reasoning,
            "error": r.error,
        }
        for r in response.results
    ]
    return await save_benchmark_run(
        session,
        server_url=response.server_url,
        model_id=response.model_id,
        provider=provider,
        instructions=response.instructions,
        temperature=response.temperature,
        aggregate_usage=response.aggregate.model_dump(),
        latency_stats={
            "total_latency_ms": response.total_latency_ms,
            "avg_latency_ms": response.avg_latency_ms,
            "min_latency_ms": response.min_latency_ms,
            "max_latency_ms": response.max_latency_ms,
            "p50_latency_ms": response.p50_latency_ms,
            "p95_latency_ms": response.p95_latency_ms,
        },
        avg_quality_score=response.avg_quality_score,
        std_dev_tokens=response.std_dev_tokens,
        results=results_data,
    )


@router.post("/benchmark/run", response_model=BenchmarkResponse)
@limiter.limit("5/minute")
async def benchmark_run(request: Request, req: BenchmarkRequest, session: AsyncSession = Depends(get_session)):
    """Run a benchmark with all inputs provided from the UI."""
    response = await run_benchmark(req)
    try:
        run_id = await _persist_run(response, req.provider, session)
        response.id = run_id
    except Exception:
        logger.warning("Failed to persist benchmark run", exc_info=True)
    return response


@router.post("/benchmark/compare", response_model=ComparisonBenchmarkResponse)
@limiter.limit("3/minute")
async def benchmark_compare(request: Request, req: ComparisonBenchmarkRequest, session: AsyncSession = Depends(get_session)):
    """Run benchmarks for multiple configurations side by side."""
    tasks = [run_benchmark(config) for config in req.configs]
    results: list[BenchmarkResponse] = await asyncio.gather(*tasks)
    for i, res in enumerate(results):
        try:
            run_id = await _persist_run(res, req.configs[i].provider, session)
            res.id = run_id
        except Exception:
            logger.warning("Failed to persist comparison run %d", i, exc_info=True)
    return ComparisonBenchmarkResponse(results=results)


@router.post("/assess", response_model=AssessmentResponse)
@limiter.limit("10/minute")
async def run_assessment(request: Request, req: AssessmentRequest):
    """Auto-assess benchmark results using the skills knowledge base."""
    return await assess(req)
