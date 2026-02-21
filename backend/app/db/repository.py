"""Data access layer for all database operations."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    AgentTrace,
    BenchmarkResult,
    BenchmarkRun,
    OptimizationRun,
    PricingModel,
    Team,
    TraceStep,
)

logger = logging.getLogger(__name__)

DEFAULT_TEAM_ID = "default"


async def ensure_default_team(session: AsyncSession) -> None:
    result = await session.execute(select(Team).where(Team.id == DEFAULT_TEAM_ID))
    if result.scalar_one_or_none() is None:
        session.add(Team(id=DEFAULT_TEAM_ID, name="Default Team"))
        await session.commit()


# --- Benchmark Runs ---


async def save_benchmark_run(
    session: AsyncSession,
    *,
    server_url: str,
    model_id: str,
    provider: str,
    instructions: str,
    temperature: float | None,
    aggregate_usage: dict,
    latency_stats: dict,
    avg_quality_score: float | None,
    std_dev_tokens: float,
    results: list[dict],
    team_id: str = DEFAULT_TEAM_ID,
) -> str:
    run_id = str(uuid.uuid4())
    run = BenchmarkRun(
        id=run_id,
        team_id=team_id,
        server_url=server_url,
        model_id=model_id,
        provider=provider,
        instructions=instructions,
        temperature=temperature,
        aggregate_usage=aggregate_usage,
        latency_stats=latency_stats,
        avg_quality_score=avg_quality_score,
        std_dev_tokens=std_dev_tokens,
    )
    session.add(run)

    for i, r in enumerate(results):
        session.add(BenchmarkResult(
            run_id=run_id,
            order_index=i,
            prompt=r["prompt"],
            response_text=r.get("response_text", ""),
            input_tokens=r.get("input_tokens", 0),
            output_tokens=r.get("output_tokens", 0),
            total_tokens=r.get("total_tokens", 0),
            latency_ms=r.get("latency_ms", 0),
            api_used=r.get("api_used", ""),
            quality_score=r.get("quality_score"),
            quality_reasoning=r.get("quality_reasoning", ""),
            error=r.get("error"),
        ))

    await session.commit()
    logger.info("Saved benchmark run %s with %d results", run_id, len(results))
    return run_id


async def list_benchmark_runs(
    session: AsyncSession,
    *,
    team_id: str = DEFAULT_TEAM_ID,
    model_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[BenchmarkRun], int]:
    query = select(BenchmarkRun).where(BenchmarkRun.team_id == team_id)
    count_query = select(func.count()).select_from(BenchmarkRun).where(BenchmarkRun.team_id == team_id)

    if model_id:
        query = query.where(BenchmarkRun.model_id == model_id)
        count_query = count_query.where(BenchmarkRun.model_id == model_id)

    total = (await session.execute(count_query)).scalar() or 0
    query = query.order_by(BenchmarkRun.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def get_benchmark_run(session: AsyncSession, run_id: str) -> BenchmarkRun | None:
    result = await session.execute(
        select(BenchmarkRun)
        .where(BenchmarkRun.id == run_id)
        .options(selectinload(BenchmarkRun.results))
    )
    return result.scalar_one_or_none()


async def delete_benchmark_run(session: AsyncSession, run_id: str) -> bool:
    run = await get_benchmark_run(session, run_id)
    if run is None:
        return False
    await session.delete(run)
    await session.commit()
    return True


# --- Agent Traces ---


async def save_trace(
    session: AsyncSession,
    *,
    name: str,
    description: str,
    source_format: str,
    trace_metadata: dict,
    steps: list[dict],
    team_id: str = DEFAULT_TEAM_ID,
) -> str:
    total_tokens = 0
    total_latency = 0.0
    cumulative = 0

    trace_id = str(uuid.uuid4())
    trace = AgentTrace(
        id=trace_id,
        team_id=team_id,
        name=name,
        description=description,
        source_format=source_format,
        trace_metadata=trace_metadata,
        total_steps=len(steps),
    )
    session.add(trace)

    for i, s in enumerate(steps):
        step_tokens = s.get("total_tokens", 0) or (s.get("input_tokens", 0) + s.get("output_tokens", 0))
        cumulative += step_tokens
        total_tokens += step_tokens
        total_latency += s.get("latency_ms", 0)

        session.add(TraceStep(
            trace_id=trace_id,
            step_number=i,
            step_type=s.get("step_type", "inference"),
            role=s.get("role", ""),
            content=s.get("content", ""),
            output=s.get("output", ""),
            tool_name=s.get("tool_name", ""),
            tool_calls=s.get("tool_calls", []),
            input_tokens=s.get("input_tokens", 0),
            output_tokens=s.get("output_tokens", 0),
            total_tokens=step_tokens,
            latency_ms=s.get("latency_ms", 0),
            cumulative_tokens=cumulative,
            step_metadata=s.get("metadata", {}),
        ))

    trace.total_tokens = total_tokens
    trace.total_latency_ms = total_latency

    await session.commit()
    logger.info("Saved trace %s (%s) with %d steps, %d total tokens", trace_id, name, len(steps), total_tokens)
    return trace_id


async def list_traces(
    session: AsyncSession,
    *,
    team_id: str = DEFAULT_TEAM_ID,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AgentTrace], int]:
    count_query = select(func.count()).select_from(AgentTrace).where(AgentTrace.team_id == team_id)
    total = (await session.execute(count_query)).scalar() or 0

    query = (
        select(AgentTrace)
        .where(AgentTrace.team_id == team_id)
        .order_by(AgentTrace.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def get_trace(session: AsyncSession, trace_id: str) -> AgentTrace | None:
    result = await session.execute(
        select(AgentTrace)
        .where(AgentTrace.id == trace_id)
        .options(selectinload(AgentTrace.steps))
    )
    return result.scalar_one_or_none()


async def delete_trace(session: AsyncSession, trace_id: str) -> bool:
    trace = await get_trace(session, trace_id)
    if trace is None:
        return False
    await session.delete(trace)
    await session.commit()
    return True


# --- Optimization Runs ---


async def save_optimization_run(
    session: AsyncSession,
    *,
    suggestions: list[dict],
    revised_instructions: str,
    summary: str,
    benchmark_run_id: str | None = None,
    trace_id: str | None = None,
    team_id: str = DEFAULT_TEAM_ID,
) -> str:
    opt = OptimizationRun(
        team_id=team_id,
        benchmark_run_id=benchmark_run_id,
        trace_id=trace_id,
        suggestions=suggestions,
        revised_instructions=revised_instructions,
        summary=summary,
    )
    session.add(opt)
    await session.commit()
    return opt.id


# --- Pricing Models ---


async def get_all_pricing(session: AsyncSession) -> list[PricingModel]:
    result = await session.execute(
        select(PricingModel).order_by(PricingModel.provider, PricingModel.model_id)
    )
    return list(result.scalars().all())


async def upsert_pricing(
    session: AsyncSession,
    *,
    provider: str,
    model_id: str,
    display_name: str,
    input_per_million: float,
    output_per_million: float,
    is_custom: bool = False,
) -> str:
    result = await session.execute(
        select(PricingModel).where(
            PricingModel.provider == provider,
            PricingModel.model_id == model_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.display_name = display_name
        existing.input_per_million = input_per_million
        existing.output_per_million = output_per_million
        existing.is_custom = is_custom
        existing.updated_at = datetime.now(timezone.utc)
        await session.commit()
        return existing.id

    pm = PricingModel(
        provider=provider,
        model_id=model_id,
        display_name=display_name,
        input_per_million=input_per_million,
        output_per_million=output_per_million,
        is_custom=is_custom,
    )
    session.add(pm)
    await session.commit()
    return pm.id


async def delete_custom_pricing(session: AsyncSession, pricing_id: str) -> bool:
    result = await session.execute(
        select(PricingModel).where(PricingModel.id == pricing_id, PricingModel.is_custom == True)  # noqa: E712
    )
    pm = result.scalar_one_or_none()
    if pm is None:
        return False
    await session.delete(pm)
    await session.commit()
    return True


async def seed_pricing_if_empty(session: AsyncSession, seed_data: list[dict]) -> int:
    count = (await session.execute(select(func.count()).select_from(PricingModel))).scalar() or 0
    if count > 0:
        return 0

    added = 0
    for entry in seed_data:
        session.add(PricingModel(
            provider=entry["provider"],
            model_id=entry["model_id"],
            display_name=entry["display_name"],
            input_per_million=entry["input_per_million"],
            output_per_million=entry["output_per_million"],
            is_custom=False,
        ))
        added += 1

    await session.commit()
    logger.info("Seeded %d pricing entries", added)
    return added
