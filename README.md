# Promptly

[![CI](https://github.com/YOUR-ORG/promptly/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR-ORG/promptly/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

An open-source tool for measuring, optimizing, and reducing LLM token costs. Connect to any Llama Stack or OpenAI-compatible server, benchmark token usage, get AI-powered optimization suggestions, analyze multi-step agent traces, compare costs across providers, and track quality — all from a single UI.

## Features

- **On-Demand Benchmarking** — Enter any server URL, auto-discover models, and run token usage benchmarks with custom instructions and test prompts
- **Server-Reported Token Usage** — Token counts come from the inference server's `usage` object (Responses API with Chat Completions fallback), never estimated client-side
- **Multi-Run Averaging** — Run each prompt 1–10 times and get averaged token usage with statistical measures (std dev, p50/p95 latency)
- **AI-Powered Assessment** — Automatic post-benchmark assessment that tells you whether optimization is worthwhile
- **AI-Powered Optimization** — Concrete suggestions to reduce token usage, with one-click instruction revision and before/after ROI comparison
- **Quality Scoring** — LLM-as-judge quality evaluation (1–10 scale) alongside token metrics, with optional reference output comparison
- **Side-by-Side Comparison** — Compare different models or instructions against the same prompts
- **Agent Trace Analysis** — Upload multi-step agent traces (simple JSON, OpenTelemetry, or LangSmith format) and analyze token usage across full workflows
- **Cost Projection** — Built-in pricing data for major providers; calculate and compare costs at scale
- **Skills System** — Extensible best-practice knowledge base in Goose-compatible SKILL.md format, automatically injected into AI analysis
- **Multi-Provider Support** — Works with Llama Stack servers and any OpenAI-compatible API (vLLM, Ollama, TGI, Azure, etc.)
- **Persistence** — Benchmark runs and traces are saved to a database (SQLite for dev, PostgreSQL for production)
- **Dark Mode** — Persisted light/dark theme toggle

## Architecture

```
UI (React 19 + Vite + Tailwind CSS 4)
  │
  ├── Benchmark tab
  │     ├── Server URL input  → POST /api/discover       → Health + model/tool discovery
  │     ├── Benchmark form    → POST /api/benchmark/run   → Token usage per prompt
  │     ├── Comparison mode   → POST /api/benchmark/compare → Side-by-side results
  │     ├── Auto-assessment   → POST /api/assess          → AI verdict (optimize/review/efficient)
  │     └── Optimize button   → POST /api/optimize        → AI suggestions + revised instructions
  │
  ├── Traces tab
  │     ├── Upload trace      → POST /api/traces          → Store + analyze
  │     ├── View traces       → GET  /api/traces          → List with summaries
  │     └── Optimize trace    → POST /api/traces/:id/optimize → AI suggestions
  │
  ├── Costs tab               → GET  /api/pricing         → Provider pricing data
  │
  └── History tab             → GET  /api/runs            → Persisted benchmark runs

Backend (FastAPI + Python 3.11)
  │
  ├── Connectors
  │     ├── Llama Stack — Responses API + Chat Completions fallback
  │     └── OpenAI-compatible — Standard /v1/chat/completions
  │
  ├── Services
  │     ├── Benchmark Engine — runs prompts, collects usage, computes stats
  │     ├── AI Assessor — quick verdict on optimization potential
  │     ├── AI Analyzer — generates optimization suggestions using skills
  │     ├── Quality Scorer — LLM-as-judge response evaluation
  │     ├── Trace Analyzer — heuristic + AI-powered trace optimization
  │     ├── Trace Parser — normalizes OpenTelemetry, LangSmith, simple formats
  │     ├── Skills Manager — loads Goose-compatible SKILL.md files
  │     └── Pricing Service — seed data + custom pricing management
  │
  ├── Database (SQLAlchemy async)
  │     ├── SQLite (development)
  │     └── PostgreSQL (production via asyncpg)
  │
  └── Observability
        ├── Structured JSON logging (python-json-logger)
        ├── Prometheus metrics (/metrics)
        └── OpenTelemetry tracing (optional, env-driven)
```

## Quick Start

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
CONFIG_PATH=../config.yaml SKILLS_DIR=../skills uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `localhost:8080`.

### Container (Podman / Docker)

```bash
# Build and run with PostgreSQL
podman-compose up --build
# or
docker compose up --build
```

Available at `http://localhost:8080`.

### OpenShift / Kubernetes Deployment

```bash
# Build the image
podman build -t promptly:latest .

# Push to your registry
podman tag promptly:latest your-registry.example.com/promptly:latest
podman push your-registry.example.com/promptly:latest

# Edit deploy/configmap.yaml with your optimizer LLM server URL
# Edit deploy/deployment.yaml with your image reference
# Create a Secret named "promptly-db" with key "url" for the database connection string

# Deploy with kustomize
oc apply -k deploy/
```

## Configuration

`config.yaml` configures the tool's own optimizer LLM — the LLM that generates optimization suggestions, assessments, and quality scores. All agent testing inputs (server URL, model, prompts) come from the UI.

```yaml
optimizer:
  server_url: "https://your-llama-stack-server.example.com"
  model: "your-model-id"

database:
  url: "sqlite+aiosqlite:///./data/promptly.db"
  echo: false

security:
  ssl_verify: true                   # true | false | "/path/to/ca-bundle.crt"
  cors_origins:
    - "http://localhost:5173"
    - "http://localhost:8080"
  api_key: ""                        # empty = no auth (dev mode)
  rate_limit: "10/minute"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONFIG_PATH` | `config.yaml` | Path to the YAML config file |
| `DATABASE_URL` | _(from config)_ | Override database connection string |
| `SKILLS_DIR` | `../skills` | Path to the skills directory |
| `LOG_FORMAT` | `json` | Logging format: `json` or `text` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(unset)_ | Enable OpenTelemetry tracing to this endpoint |

## API Endpoints

### Health

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Basic health check |
| `/api/health/deep` | GET | Yes | Check optimizer LLM connectivity |
| `/api/health/server?url=...` | GET | Yes | Check a target server's health (SSRF-protected) |

### Discovery

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/discover` | POST | Yes | Discover models and tools on a server |

### Benchmarking

| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|------------|-------------|
| `/api/benchmark/run` | POST | Yes | 5/min | Run benchmark with prompts |
| `/api/benchmark/compare` | POST | Yes | 3/min | Compare multiple configurations side-by-side |
| `/api/assess` | POST | Yes | 10/min | AI assessment of benchmark results |

### Optimization

| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|------------|-------------|
| `/api/optimize` | POST | Yes | 5/min | Generate AI optimization suggestions |

### Benchmark Runs (Persistence)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/runs` | GET | Yes | List benchmark runs (paginated) |
| `/api/runs/{id}` | GET | Yes | Get a run with all results |
| `/api/runs/{id}` | DELETE | Yes | Delete a run |
| `/api/runs/{id}/export` | GET | Yes | Export a run as JSON |

### Agent Traces

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/traces` | POST | Yes | Upload an agent trace |
| `/api/traces` | GET | Yes | List traces (paginated) |
| `/api/traces/{id}` | GET | Yes | Get a trace with all steps |
| `/api/traces/{id}` | DELETE | Yes | Delete a trace |
| `/api/traces/{id}/optimize` | POST | Yes | AI optimization for a trace |
| `/api/traces/{id}/export` | GET | Yes | Export a trace as JSON |

### Pricing

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/pricing` | GET | No | List all pricing data (built-in + custom) |
| `/api/pricing/custom` | POST | Yes | Add or update custom model pricing |
| `/api/pricing/custom/{id}` | DELETE | Yes | Delete a custom pricing entry |
| `/api/pricing/calculate` | POST | No | Calculate cost for given token counts |

### Skills

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/skills` | GET | Yes | List optimization skills |
| `/api/skills/{name}` | GET | Yes | Get skill content |

### Observability

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/metrics` | GET | No | Prometheus metrics |

## Optimization Skills

Skills are Goose-compatible SKILL.md files in the `skills/` directory that provide domain knowledge to the AI optimizer:

- **instruction-optimizer** — Framework for analyzing and improving system instructions (redundancy, verbosity, structure, specificity)
- **token-efficiency** — Patterns for reducing token usage (prompt compression, context management, few-shot optimization, output control)
- **tool-use-patterns** — Best practices for tool-using agents (fewer calls, smaller definitions, batching, selective loading)
- **agent-trace-patterns** — Patterns for multi-turn agents (context management, tool efficiency, step reduction)

### Adding Custom Skills

Create a new directory under `skills/` with a `SKILL.md` file:

```markdown
---
name: My Custom Skill
description: One-line description of what this skill covers
---

# Skill Content

Your optimization knowledge, patterns, and examples in markdown.
```

Skills are automatically loaded and injected into all AI-powered analysis.

## Agent Trace Formats

Promptly accepts agent traces in three formats:

| Format | Description |
|--------|-------------|
| **Simple** | Array of steps with `step_type`, `input_tokens`, `output_tokens`, `latency_ms`, `content`, `output` |
| **OpenTelemetry** | OpenInference spans with `openinference.span.kind`, `llm.token_count.*` attributes |
| **LangSmith** | LangSmith run traces with `run_type`, `prompt_tokens`, `completion_tokens`, timing |

## Security

- **SSL verification**: Configurable per-deployment (system CA, custom CA bundle, or disabled for internal networks)
- **CORS**: Restricted to configured origins (not wildcard)
- **SSRF protection**: URL validation blocks private IPs, internal ranges, localhost, and cloud metadata endpoints
- **Path traversal**: Skills endpoint validates resolved paths stay within the skills directory
- **API key auth**: Optional shared API key via `X-API-Key` header (disable for development)
- **Rate limiting**: Per-endpoint limits on expensive LLM-calling endpoints
- **Request IDs**: `X-Request-ID` header on all requests for log correlation
- **Non-root container**: Runs as UID 1001

## Testing

```bash
# Backend
cd backend
pip install -r requirements-dev.txt
pytest

# Frontend
cd frontend
npm install
npm test
```

CI runs on every push and PR to `main` via GitHub Actions: backend lint (ruff) + test (pytest), frontend lint (ESLint) + test (Vitest), and Docker image build.

## Project Structure

```
├── config.yaml                       # Optimizer LLM + database + security config
├── Dockerfile                        # Multi-stage UBI9 build (Node 20 + Python 3.11)
├── docker-compose.yaml               # Podman/Docker Compose (PostgreSQL + app)
├── .github/workflows/ci.yml          # CI pipeline (lint, test, build)
├── skills/                           # Goose-compatible optimization skills
│   ├── instruction-optimizer/SKILL.md
│   ├── token-efficiency/SKILL.md
│   ├── tool-use-patterns/SKILL.md
│   └── agent-trace-patterns/SKILL.md
├── deploy/                           # OpenShift / Kubernetes manifests (Kustomize)
│   ├── kustomization.yaml
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── route.yaml
├── backend/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── pyproject.toml
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_routers.py
│   │   ├── test_url_validator.py
│   │   ├── test_skills_manager.py
│   │   ├── test_analyzer.py
│   │   └── test_stream_handler.py
│   └── app/
│       ├── main.py                   # FastAPI app, middleware, lifespan
│       ├── config.py                 # YAML config loader with Pydantic models
│       ├── connectors/
│       │   ├── base.py               # ProviderConnector ABC
│       │   ├── llama_stack.py        # Llama Stack (Responses + Chat Completions)
│       │   └── openai_compat.py      # OpenAI-compatible /v1/chat/completions
│       ├── db/
│       │   ├── engine.py             # Async engine, session factory, init/close
│       │   ├── models.py             # SQLAlchemy ORM models
│       │   └── repository.py         # CRUD operations
│       ├── middleware/
│       │   └── auth.py               # Optional API key authentication
│       ├── models/
│       │   └── schemas.py            # Pydantic request/response schemas
│       ├── routers/
│       │   ├── health.py             # Health check endpoints
│       │   ├── discover.py           # Model/tool discovery
│       │   ├── benchmark.py          # Benchmark execution + assessment
│       │   ├── optimizer.py          # Optimization suggestions
│       │   ├── runs.py               # Benchmark run CRUD
│       │   ├── traces.py             # Trace upload, analysis, optimization
│       │   ├── pricing.py            # Pricing management + cost calculation
│       │   └── skills.py             # Skills listing
│       ├── services/
│       │   ├── benchmark.py          # Benchmark engine
│       │   ├── analyzer.py           # AI optimization analyzer
│       │   ├── assessor.py           # AI post-benchmark assessment
│       │   ├── quality_scorer.py     # LLM-as-judge quality scoring
│       │   ├── trace_analyzer.py     # Trace analysis (heuristic + AI)
│       │   ├── trace_parser.py       # Trace format normalization
│       │   ├── skills_manager.py     # SKILL.md file loader
│       │   ├── stream_handler.py     # SSE parsing + usage extraction
│       │   ├── pricing.py            # Pricing seed data + cost calculation
│       │   └── pricing_seed.json     # Built-in model pricing data
│       └── utils/
│           └── url_validator.py      # URL validation + SSRF protection
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── vitest.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx                   # Main app with tab navigation
        ├── main.tsx                  # Entry point with ErrorBoundary
        ├── index.css                 # Tailwind + theme variables
        ├── api/
        │   ├── client.ts             # API client (fetch wrapper)
        │   └── types.ts              # TypeScript interfaces
        ├── hooks/
        │   ├── useServerDiscovery.ts
        │   ├── useBenchmark.ts
        │   ├── useOptimizer.ts
        │   ├── useTraces.ts
        │   ├── usePricing.ts
        │   └── useSkills.ts
        ├── lib/
        │   ├── utils.ts              # formatNumber, formatLatency
        │   ├── pricing.ts            # Client-side pricing helpers
        │   ├── history.ts            # History persistence
        │   └── diff.ts               # Word-level diff for prompt comparison
        └── components/
            ├── ErrorBoundary.tsx
            ├── benchmark/            # ServerConnect, TestConfig, ResultsSummary,
            │                         # AssessmentCard, BenchmarkResults, ROISummary,
            │                         # ComparisonView, BeforeAfterComparison
            ├── optimizer/            # OptimizationReport, SuggestionCard, PromptDiff
            ├── traces/               # TraceUpload, TracesList, TraceAnalysisCard,
            │                         # TraceTimeline, TraceOptimizationReport
            ├── costs/                # CostTab
            ├── history/              # HistoryPanel
            ├── skills/               # SkillsList, SkillDetail
            └── __tests__/            # BenchmarkResults, ErrorBoundary, SkillsList tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and the pull request process.

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
