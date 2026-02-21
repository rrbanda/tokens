import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pythonjsonlogger.json import JsonFormatter
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import load_config
from app.routers import benchmark, discover, health, optimizer, pricing, runs, skills, traces


def _setup_logging() -> None:
    log_format = os.environ.get("LOG_FORMAT", "json")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()

    handler = logging.StreamHandler()
    if log_format == "json":
        handler.setFormatter(JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level"},
        ))
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

    root.addHandler(handler)


_setup_logging()
logger = logging.getLogger(__name__)

_cfg = load_config()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[_cfg.security.rate_limit],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = load_config()
    logger.info("Config loaded. Optimizer server: %s", cfg.optimizer.server_url or "(not set)")

    from app.db.engine import close_db, init_db

    await init_db()

    _setup_otel(app)
    _setup_prometheus(app)

    yield

    await close_db()


def _setup_otel(app: FastAPI) -> None:
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({"service.name": "promptly"})
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))

        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
        HTTPXClientInstrumentor().instrument(tracer_provider=provider)
        logger.info("OpenTelemetry tracing enabled, exporting to %s", endpoint)
    except Exception:
        logger.warning("Failed to initialize OpenTelemetry", exc_info=True)


def _setup_prometheus(app: FastAPI) -> None:
    try:
        from prometheus_fastapi_instrumentator import Instrumentator
        Instrumentator().instrument(app).expose(app, endpoint="/metrics")
        logger.info("Prometheus metrics exposed at /metrics")
    except Exception:
        logger.warning("Failed to initialize Prometheus metrics", exc_info=True)


app = FastAPI(title="Promptly", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cfg.security.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
)

app.include_router(health.router)
app.include_router(discover.router)
app.include_router(benchmark.router)
app.include_router(skills.router)
app.include_router(optimizer.router)
app.include_router(runs.router)
app.include_router(traces.router)
app.include_router(pricing.router)

static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
