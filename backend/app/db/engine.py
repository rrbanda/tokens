import logging
from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_config

logger = logging.getLogger(__name__)

_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


async def init_db() -> None:
    """Create the async engine, run Alembic migrations, and prepare the session factory."""
    global _engine, _session_factory

    cfg = get_config()
    db_url = cfg.database.url

    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        db_path = db_url.split("///")[-1] if "///" in db_url else None
        if db_path:
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    _engine = create_async_engine(
        db_url,
        echo=cfg.database.echo,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)

    from app.db.models import Base

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with _session_factory() as session:
        from app.db.repository import ensure_default_team
        from app.services.pricing import initialize_pricing

        await ensure_default_team(session)
        await initialize_pricing(session)

    logger.info("Database initialized: %s", db_url.split("@")[-1] if "@" in db_url else db_url)


async def close_db() -> None:
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async DB session."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    async with _session_factory() as session:
        yield session
