import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    benchmark_runs: Mapped[list["BenchmarkRun"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    agent_traces: Mapped[list["AgentTrace"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), default="default")
    server_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="llama_stack")
    instructions: Mapped[str] = mapped_column(Text, default="")
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    aggregate_usage: Mapped[dict] = mapped_column(SQLiteJSON, default=dict)
    latency_stats: Mapped[dict] = mapped_column(SQLiteJSON, default=dict)
    avg_quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_dev_tokens: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    team: Mapped["Team"] = relationship(back_populates="benchmark_runs")
    results: Mapped[list["BenchmarkResult"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="BenchmarkResult.order_index"
    )
    optimization_runs: Mapped[list["OptimizationRun"]] = relationship(back_populates="benchmark_run", cascade="all, delete-orphan")


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("benchmark_runs.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    response_text: Mapped[str] = mapped_column(Text, default="")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    api_used: Mapped[str] = mapped_column(String(50), default="")
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_reasoning: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped["BenchmarkRun"] = relationship(back_populates="results")


class AgentTrace(Base):
    __tablename__ = "agent_traces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), default="default")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    source_format: Mapped[str] = mapped_column(String(50), default="simple")
    trace_metadata: Mapped[dict] = mapped_column(SQLiteJSON, default=dict)
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    team: Mapped["Team"] = relationship(back_populates="agent_traces")
    steps: Mapped[list["TraceStep"]] = relationship(
        back_populates="trace", cascade="all, delete-orphan", order_by="TraceStep.step_number"
    )
    optimization_runs: Mapped[list["OptimizationRun"]] = relationship(back_populates="trace", cascade="all, delete-orphan")


class TraceStep(Base):
    __tablename__ = "trace_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    trace_id: Mapped[str] = mapped_column(String(36), ForeignKey("agent_traces.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    output: Mapped[str] = mapped_column(Text, default="")
    tool_name: Mapped[str] = mapped_column(String(255), default="")
    tool_calls: Mapped[dict] = mapped_column(SQLiteJSON, default=list)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    cumulative_tokens: Mapped[int] = mapped_column(Integer, default=0)
    step_metadata: Mapped[dict] = mapped_column(SQLiteJSON, default=dict)

    trace: Mapped["AgentTrace"] = relationship(back_populates="steps")


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    team_id: Mapped[str] = mapped_column(String(36), default="default")
    benchmark_run_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("benchmark_runs.id"), nullable=True)
    trace_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("agent_traces.id"), nullable=True)
    suggestions: Mapped[dict] = mapped_column(SQLiteJSON, default=list)
    revised_instructions: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    benchmark_run: Mapped["BenchmarkRun | None"] = relationship(back_populates="optimization_runs")
    trace: Mapped["AgentTrace | None"] = relationship(back_populates="optimization_runs")


class PricingModel(Base):
    __tablename__ = "pricing_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    input_per_million: Mapped[float] = mapped_column(Float, nullable=False)
    output_per_million: Mapped[float] = mapped_column(Float, nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
