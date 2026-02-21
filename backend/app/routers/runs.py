"""CRUD endpoints for persisted benchmark runs."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_session
from app.db.repository import delete_benchmark_run, get_benchmark_run, list_benchmark_runs
from app.middleware.auth import require_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["runs"], dependencies=[Depends(require_api_key)])


def _run_to_dict(run) -> dict:
    return {
        "id": run.id,
        "server_url": run.server_url,
        "model_id": run.model_id,
        "provider": run.provider,
        "instructions": run.instructions,
        "temperature": run.temperature,
        "aggregate_usage": run.aggregate_usage,
        "latency_stats": run.latency_stats,
        "avg_quality_score": run.avg_quality_score,
        "std_dev_tokens": run.std_dev_tokens,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


def _run_to_full_dict(run) -> dict:
    d = _run_to_dict(run)
    d["results"] = [
        {
            "prompt": r.prompt,
            "response_text": r.response_text,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "total_tokens": r.total_tokens,
            "latency_ms": r.latency_ms,
            "api_used": r.api_used,
            "quality_score": r.quality_score,
            "quality_reasoning": r.quality_reasoning,
            "error": r.error,
        }
        for r in sorted(run.results, key=lambda x: x.order_index)
    ]
    return d


@router.get("/runs")
async def list_runs(
    session: AsyncSession = Depends(get_session),
    model_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List benchmark runs with pagination."""
    runs, total = await list_benchmark_runs(session, model_id=model_id, limit=limit, offset=offset)
    return {
        "runs": [_run_to_dict(r) for r in runs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/runs/{run_id}")
async def get_run(run_id: str, session: AsyncSession = Depends(get_session)):
    """Get a single benchmark run with all its results."""
    run = await get_benchmark_run(session, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_full_dict(run)


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a benchmark run."""
    deleted = await delete_benchmark_run(session, run_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"deleted": True}


@router.get("/runs/{run_id}/export")
async def export_run(run_id: str, session: AsyncSession = Depends(get_session)):
    """Export a benchmark run as JSON for download."""
    run = await get_benchmark_run(session, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    data = _run_to_full_dict(run)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f'attachment; filename="run-{run_id}.json"'},
    )
