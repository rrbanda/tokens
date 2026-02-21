"""Agent trace upload, analysis, and optimization endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_session
from app.db.repository import delete_trace, get_trace, list_traces, save_trace
from app.middleware.auth import require_api_key
from app.models.schemas import TraceUploadRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["traces"], dependencies=[Depends(require_api_key)])


def _trace_summary(trace) -> dict:
    return {
        "id": trace.id,
        "name": trace.name,
        "description": trace.description,
        "source_format": trace.source_format,
        "total_steps": trace.total_steps,
        "total_tokens": trace.total_tokens,
        "total_latency_ms": trace.total_latency_ms,
        "created_at": trace.created_at.isoformat() if trace.created_at else None,
    }


def _trace_full(trace) -> dict:
    d = _trace_summary(trace)
    d["metadata"] = trace.trace_metadata
    d["steps"] = [
        {
            "step_number": s.step_number,
            "step_type": s.step_type,
            "role": s.role,
            "content": s.content,
            "output": s.output,
            "tool_name": s.tool_name,
            "tool_calls": s.tool_calls,
            "input_tokens": s.input_tokens,
            "output_tokens": s.output_tokens,
            "total_tokens": s.total_tokens,
            "latency_ms": s.latency_ms,
            "cumulative_tokens": s.cumulative_tokens,
            "metadata": s.step_metadata,
        }
        for s in sorted(trace.steps, key=lambda x: x.step_number)
    ]
    return d


@router.post("/traces")
async def upload_trace(req: TraceUploadRequest, session: AsyncSession = Depends(get_session)):
    """Upload an agent trace for analysis."""
    from app.services.trace_analyzer import analyze_trace_steps

    steps_data = [s.model_dump() for s in req.steps]
    trace_id = await save_trace(
        session,
        name=req.name,
        description=req.description,
        source_format=req.source_format,
        trace_metadata=req.metadata,
        steps=steps_data,
    )

    analysis = analyze_trace_steps(steps_data)

    return {"id": trace_id, "analysis": analysis}


@router.get("/traces")
async def list_all_traces(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List uploaded traces with pagination."""
    traces, total = await list_traces(session, limit=limit, offset=offset)
    return {
        "traces": [_trace_summary(t) for t in traces],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/traces/{trace_id}")
async def get_single_trace(trace_id: str, session: AsyncSession = Depends(get_session)):
    """Get a trace with all its steps."""
    trace = await get_trace(session, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    return _trace_full(trace)


@router.delete("/traces/{trace_id}")
async def delete_single_trace(trace_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a trace."""
    deleted = await delete_trace(session, trace_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trace not found")
    return {"deleted": True}


@router.post("/traces/{trace_id}/optimize")
async def optimize_trace(trace_id: str, session: AsyncSession = Depends(get_session)):
    """Run AI optimization on an uploaded trace."""
    from app.services.trace_analyzer import optimize_agent_trace

    trace = await get_trace(session, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")

    steps_data = [
        {
            "step_type": s.step_type,
            "role": s.role,
            "content": s.content,
            "output": s.output,
            "tool_name": s.tool_name,
            "tool_calls": s.tool_calls,
            "input_tokens": s.input_tokens,
            "output_tokens": s.output_tokens,
            "total_tokens": s.total_tokens,
            "latency_ms": s.latency_ms,
            "cumulative_tokens": s.cumulative_tokens,
        }
        for s in sorted(trace.steps, key=lambda x: x.step_number)
    ]

    result = await optimize_agent_trace(trace.name, steps_data)
    return result


@router.get("/traces/{trace_id}/export")
async def export_trace(trace_id: str, session: AsyncSession = Depends(get_session)):
    """Export a trace as JSON for download."""
    trace = await get_trace(session, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    data = _trace_full(trace)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f'attachment; filename="trace-{trace_id}.json"'},
    )
