# Promptly — Production Readiness Review

**Date**: 2026-02-20
**Scope**: Full codebase review — backend, frontend, deployment, security, testing, open-source readiness

---

## Executive Summary

Promptly is a **well-architected, useful tool** for measuring and optimizing LLM token costs. It has a clean codebase with proper layering, sensible security defaults, structured logging, observability hooks, and a pleasant UI. The project has addressed foundational security requirements (SSRF protection, path traversal prevention, configurable CORS, optional API key auth, rate limiting) and has both backend and frontend tests with CI.

**Overall Verdict: Solid Internal Tool / Near Production-Ready** — requires open-source scaffolding, expanded test coverage, and minor cleanup before public release.

| Area                    | Verdict        | Remaining Gaps |
|-------------------------|----------------|----------------|
| Security                | GOOD           | Low            |
| Architecture & Code     | GOOD           | Low            |
| Frontend                | GOOD           | Low            |
| Testing                 | Needs Work     | Medium         |
| Deployment & Operations | GOOD           | Low            |
| Open-Source Readiness    | NOT READY      | High           |
| Usefulness              | EXCELLENT      | None           |

---

## 1. Security Audit

**Verdict: GOOD — foundational protections in place**

### 1.1 SSL Verification — Configurable (Resolved)

SSL verification is controlled via `config.yaml` → `security.ssl_verify` (defaults to `true`). All connectors and services use a `_ssl_verify()` helper that reads this config value:

```python
def _ssl_verify() -> bool | str:
    return get_config().security.ssl_verify
```

The `ssl_verify` field accepts `bool | str`, so it can be set to `true`, `false`, or a CA bundle path like `"/path/to/ca-bundle.crt"`. Used consistently in `llama_stack.py`, `openai_compat.py`, `analyzer.py`, `assessor.py`, `quality_scorer.py`, and `trace_analyzer.py`.

### 1.2 CORS — Properly Configured (Resolved)

CORS is configured from `config.yaml` origins, not wildcards:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cfg.security.cors_origins,  # from config.yaml
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
)
```

Default origins: `["http://localhost:5173"]`. No credentials mode. Only specific HTTP methods and headers.

### 1.3 Path Traversal — Protected (Resolved)

`SkillsManager.get_skill()` validates the resolved path is within the skills directory:

```python
skill_file = (self.skills_dir / name / "SKILL.md").resolve()
if not skill_file.is_relative_to(self.skills_dir.resolve()):
    logger.warning("Path traversal attempt blocked: %s", name)
    return None
```

Test coverage exists in `test_skills_manager.py`.

### 1.4 SSRF Protection — Implemented (Resolved)

`app/utils/url_validator.py` validates all user-supplied URLs before server-side requests:

- Blocks private/internal IP ranges (`169.254.`, `127.0.0.`, `10.`, `172.16.`, `192.168.`, `localhost`, `[::1]`)
- Validates scheme is `http` or `https`
- Checks `ipaddress.ip_address()` for private, loopback, link-local, and reserved IPs
- Configurable blocked patterns via `config.yaml` → `security.blocked_url_patterns`
- Applied on `/api/health/server` and `/api/discover` endpoints

Test coverage exists in `test_url_validator.py`.

### 1.5 Authentication — Optional API Key (Resolved)

`middleware/auth.py` provides a `require_api_key` FastAPI dependency:

- If `security.api_key` in config is empty, auth is disabled (development mode)
- If set, requires `X-API-Key` header matching the configured value
- Applied as a dependency on all routers except `/api/health` (basic), `/api/pricing` (read-only), and `/metrics`
- Logs unauthorized attempts with client IP

### 1.6 Rate Limiting — Implemented (Resolved)

`slowapi` rate limiting is integrated with per-endpoint limits:

| Endpoint                | Rate Limit |
|-------------------------|------------|
| `/api/benchmark/run`    | 5/minute   |
| `/api/benchmark/compare`| 3/minute   |
| `/api/assess`           | 10/minute  |
| `/api/optimize`         | 5/minute   |
| All others (default)    | 10/minute  |

Returns structured 429 JSON responses.

### 1.7 Remaining Security Considerations

- **No multi-user auth**: API key is a single shared key, not per-user. For multi-tenant use, integrate OAuth2 or OpenShift auth proxy.
- **Health endpoint leaks**: `check_health()` returns `str(e)` for errors, which could expose internal details. Consider sanitizing error messages.
- **No request size limits**: Large prompts or trace uploads are only bounded by Pydantic validators (20 prompts, 500 trace steps), not by request body size.

---

## 2. Architecture and Code Quality

**Verdict: GOOD — clean layered architecture**

### 2.1 Strengths

- **Clean separation of concerns**: Routers → Services → Connectors → Database, with Pydantic schemas as contracts.
- **Connector abstraction**: `ProviderConnector` ABC with `LlamaStackConnector` and `OpenAICompatConnector` implementations. New providers are straightforward to add.
- **API fallback strategy**: Responses API preferred, Chat Completions fallback — well-implemented with usage extraction from both.
- **SSE stream parsing**: Clean, focused pure functions in `stream_handler.py`.
- **Async throughout**: Fully async from FastAPI handlers through SQLAlchemy to httpx.
- **Benchmark engine**: Supports multi-run averaging, quality scoring via LLM-as-judge, percentile latency stats, and standard deviation.
- **`return_exceptions=True`**: Used correctly in `asyncio.gather()` within the benchmark service, with proper error handling for individual prompt failures.
- **Configurable logging**: JSON or text format via `LOG_FORMAT` env var, using `python-json-logger`.
- **Request ID middleware**: Adds `X-Request-ID` for tracing through logs.

### 2.2 Unused Code (Minor)

| Code | Location | Issue |
|------|----------|-------|
| `TraceAnalysisSchema` | `schemas.py:201` | Defined but never used as a response model |
| `TraceSummarySchema` | `schemas.py:217` | Defined but never used as a response model |
| `cn()` utility | `frontend/src/lib/utils.ts:3` | Exported but never imported |
| Alembic dependency | `requirements.txt` | Listed but no `alembic/` directory exists; DB uses `Base.metadata.create_all` |

### 2.3 Configuration

- Config is clean and minimal (optimizer settings, database, security)
- Supports env var overrides (`CONFIG_PATH`, `DATABASE_URL`, `SKILLS_DIR`, `LOG_FORMAT`, `OTEL_EXPORTER_OTLP_ENDPOINT`)
- Pydantic models for all config sections with sensible defaults
- Global singleton pattern (`_config`, `_manager`, `_connector`) — acceptable for this scale

---

## 3. Frontend Review

**Verdict: GOOD — modern, clean, well-organized**

### 3.1 Strengths

- Modern stack: React 19, Vite 7, Tailwind CSS 4, TypeScript 5.9 (strict mode)
- Clean hook-based architecture: `useServerDiscovery`, `useBenchmark`, `useOptimizer`, `useTraces`, `usePricing`, `useSkills`
- Proper loading states, error handling, and cancellation via `AbortController`
- Minimal dependencies (only `clsx` and `lucide-react` beyond React/React DOM)
- Utility functions properly centralized in `lib/utils.ts` and imported everywhere
- Dark mode persisted in `localStorage`
- Error boundary wrapping the app (`ErrorBoundary.tsx` + `main.tsx`)
- Accessible dark mode toggle with `aria-label`
- Tab buttons with `aria-label` and `aria-current`

### 3.2 Component Coverage

| Feature Area | Components | Hooks | Status |
|-------------|------------|-------|--------|
| Benchmark   | 8 (ServerConnect, TestConfig, ResultsSummary, AssessmentCard, BenchmarkResults, ROISummary, ComparisonView, BeforeAfterComparison) | `useServerDiscovery`, `useBenchmark` | Complete |
| Optimizer   | 3 (OptimizationReport, SuggestionCard, PromptDiff) | `useOptimizer` | Complete |
| Traces      | 5 (TraceUpload, TracesList, TraceAnalysisCard, TraceTimeline, TraceOptimizationReport) | `useTraces` | Complete |
| Costs       | 1 (CostTab) | `usePricing` | Complete |
| History     | 1 (HistoryPanel) | — | Complete |
| Skills      | 2 (SkillsList, SkillDetail) | `useSkills` | Not wired into UI tabs |

### 3.3 Remaining UX Items

- **Skills UI not exposed**: `SkillsList` and `SkillDetail` components exist, but there is no tab or route to view them. Skills are used by the backend analyzer, but users cannot browse them in the UI.
- **No confirmation dialogs**: Disconnect from server clears all results without confirmation.
- **Comparison mode**: Limited to exactly 2 configurations (by design, but worth documenting).

---

## 4. Testing Assessment

**Verdict: Needs Work — foundation exists, coverage needs expansion**

### 4.1 Current State

**Backend tests** (6 files):
| File | Coverage |
|------|----------|
| `test_routers.py` | Health, discover, benchmark, skills endpoints |
| `test_url_validator.py` | URL validation, SSRF blocking |
| `test_skills_manager.py` | Frontmatter parsing, path traversal blocking |
| `test_analyzer.py` | `_extract_json` edge cases |
| `test_stream_handler.py` | SSE parsing, usage extraction |
| `conftest.py` | TestClient, mock connector fixtures |

**Frontend tests** (3 files):
| File | Coverage |
|------|----------|
| `BenchmarkResults.test.tsx` | Renders, export button, per-prompt rows |
| `ErrorBoundary.test.tsx` | Children render, error UI when child throws |
| `SkillsList.test.tsx` | Loading, error, empty, and populated states |

**CI**: GitHub Actions workflow (`ci.yml`) runs on push/PR to `main`:
- Backend: `ruff check` (lint) + `pytest` (test)
- Frontend: `npm run lint` (ESLint) + `npm test` (Vitest)
- Docker image build (after all pass)

### 4.2 Coverage Gaps

**Backend** — missing tests for:
- Database repository (`repository.py`) — CRUD operations
- Benchmark service (`benchmark.py`) — multi-run averaging, quality scoring integration
- Trace analyzer (`trace_analyzer.py`) — heuristic suggestions, AI optimization
- Assessor (`assessor.py`) — assessment prompt formatting, result parsing
- Quality scorer (`quality_scorer.py`) — scoring logic
- Pricing service (`pricing.py`) — seed data loading, cost calculation
- Connectors (`llama_stack.py`, `openai_compat.py`) — inference, model discovery, fallback logic
- Auth middleware (`auth.py`) — key validation logic
- Config loading (`config.py`) — env override, missing file handling

**Frontend** — missing tests for:
- All hooks (`useServerDiscovery`, `useBenchmark`, `useOptimizer`, `useTraces`, `usePricing`)
- `App.tsx` (integration)
- Most components (15+ untested)
- API client (`client.ts`)

**E2E**: No Playwright, Cypress, or similar integration tests.

### 4.3 `validate-token-usage.sh`

Manual validation script demonstrating that token counts come from the Llama Stack API. It requires `LLAMA_STACK_URL` and `LLAMA_MODEL` environment variables. Not automated testing, but useful as a verification tool.

---

## 5. Deployment and Operations

**Verdict: GOOD — solid container and Kubernetes setup**

### 5.1 Dockerfile

- Multi-stage build (UBI9 Node.js 20 + Python 3.11)
- `npm ci` for reproducible frontend builds
- `pip install --no-cache-dir` for smaller image
- Explicit `USER 1001` (non-root)
- `HEALTHCHECK` instruction (curl to `/api/health`)
- Environment variables for runtime config (`CONFIG_PATH`, `SKILLS_DIR`, `LOG_FORMAT`)
- Config not baked in — provided at runtime via volume or ConfigMap

### 5.2 Docker Compose

- PostgreSQL 16 Alpine with healthcheck
- App depends on DB with `condition: service_healthy`
- Config and skills mounted read-only
- `security_opt: no-new-privileges:true`
- Compatible with both Docker Compose and Podman Compose

### 5.3 Kubernetes Manifests

- Kustomize-based deployment in `deploy/`
- Security context: `runAsNonRoot`, `runAsUser: 1001`, `runAsGroup: 0`, `allowPrivilegeEscalation: false`, drops all capabilities, `RuntimeDefault` seccomp
- Readiness and liveness probes on `/api/health`
- Resource requests and limits (256Mi–512Mi memory, 200m–500m CPU)
- Database URL from Kubernetes Secret (`promptly-db`)
- OpenShift Route with TLS edge termination

### 5.4 Observability

- **Logging**: Structured JSON via `python-json-logger` (configurable text fallback)
- **Metrics**: Prometheus endpoint at `/metrics` via `prometheus-fastapi-instrumentator`
- **Tracing**: Optional OpenTelemetry (FastAPI + httpx instrumentation) when `OTEL_EXPORTER_OTLP_ENDPOINT` is set
- **Request ID**: `X-Request-ID` header added to all requests/responses

### 5.5 Remaining Items

- **CI does not push images**: `build-image` job only runs `docker build`, does not push to a registry.
- **Deployment image reference**: `quay.io/your-org/promptly:latest` is a placeholder — needs to be customized per deployment.
- **No HPA or PDB**: Single replica with no autoscaling or disruption budgets.
- **No database migrations**: Alembic is in requirements but not configured. DB uses `Base.metadata.create_all` (fine for development, may need migrations for schema changes in production).

---

## 6. Open-Source Readiness

**Verdict: NOT READY — missing standard project files**

### 6.1 Missing Files

| File | Priority | Purpose |
|------|----------|---------|
| `LICENSE` | Critical | No license means code is legally ambiguous; cannot be used or contributed to |
| `.gitignore` (root) | Critical | No root `.gitignore`; `.venv/`, `__pycache__/`, `data/` should be ignored |
| `CONTRIBUTING.md` | High | How to contribute, development setup, code style, PR process |
| `CODE_OF_CONDUCT.md` | High | Community standards for behavior |
| `SECURITY.md` | High | How to report security vulnerabilities |
| `CHANGELOG.md` | Medium | Version history and release notes |
| `.github/ISSUE_TEMPLATE/` | Medium | Structured bug report and feature request templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | Medium | PR checklist and review guidelines |
| README badges | Medium | CI status, license, version visibility |

### 6.2 README Accuracy

The current `README.md` is **materially out of sync** with the codebase:

| Issue | Detail |
|-------|--------|
| Missing features | Traces, cost calculation, history, assessment, database persistence, pricing — not mentioned |
| Incomplete API table | Lists 8 of 25+ endpoints; missing `/api/assess`, `/api/runs/*`, `/api/traces/*`, `/api/pricing/*`, `/api/health/deep`, `/metrics` |
| Stale project tree | Missing `db/`, `middleware/`, `utils/`, `openai_compat.py`; lists nonexistent `token_tracker.py` |
| Missing skill | Lists 3 skills but 4 exist (`agent-trace-patterns` omitted) |
| No mention of | Database, env vars, OpenTelemetry, Prometheus, rate limiting, auth, traces, cost calculation |

### 6.3 `goose-repo/` Directory

A 1,700+ file external project (`goose` — AI agent framework) is checked into the repository under `goose-repo/`. It is excluded from Docker builds via `.dockerignore` and is not part of Promptly's runtime. It should be removed from the repository or converted to a Git submodule reference.

---

## 7. Usefulness Assessment

**Verdict: EXCELLENT — solves a real problem with a sound approach**

### 7.1 Value Proposition

Promptly addresses a genuine need: **measuring and reducing LLM token costs**. It provides:

1. **Server-reported metrics** — token counts from the inference server's `usage` object, not client-side estimation
2. **Benchmark-driven optimization** — test before and after instruction changes
3. **AI-powered assessment and optimization** — uses an LLM with skills context to suggest improvements
4. **Quality scoring** — LLM-as-judge quality evaluation alongside token metrics
5. **Agent trace analysis** — upload and analyze multi-step agent workflows
6. **Cost projection** — built-in pricing data for cross-provider cost comparison
7. **Multi-provider support** — Llama Stack and any OpenAI-compatible server (vLLM, Ollama, TGI, etc.)

### 7.2 Benchmark Methodology

Sound design:
- Token counts from the Llama Stack server's `usage` object
- Responses API preferred, Chat Completions fallback
- Multi-run averaging (`num_runs` 1–10)
- Percentile latency stats (p50, p95, min, max)
- Standard deviation for token count variability
- Concurrent prompt execution with `return_exceptions=True`
- Quality scoring with reference output comparison

### 7.3 Optimization Quality

The optimizer pipeline is well-designed:
- Skills knowledge base injected as domain expertise
- Full benchmark data provided for analysis
- Structured JSON output with categories, estimated savings, and risk levels
- Complete revised instructions provided for one-click application
- Before/after ROI comparison when instructions are applied

### 7.4 Skills System

Extensible and well-designed:
- YAML frontmatter + Markdown format
- Goose-compatible for interoperability
- Four useful starter skills (instruction-optimizer, token-efficiency, tool-use-patterns, agent-trace-patterns)
- Automatically loaded and injected into all optimizer/assessor prompts

---

## Remediation Priority

### P0 — Required for Open-Source Release
1. Add `LICENSE` file (Apache 2.0 recommended)
2. Add root `.gitignore`
3. Add `CONTRIBUTING.md`
4. Add `CODE_OF_CONDUCT.md`
5. Add `SECURITY.md`
6. Update `README.md` to accurately reflect all features and APIs
7. Remove or externalize `goose-repo/` directory

### P1 — Recommended Improvements
8. Add `CHANGELOG.md`
9. Add GitHub issue and PR templates
10. Add README badges (CI status, license)
11. Expand backend test coverage (connectors, services, repository)
12. Expand frontend test coverage (hooks, more components)
13. Remove unused Pydantic models (`TraceAnalysisSchema`, `TraceSummarySchema`)
14. Remove unused `cn()` utility export

### P2 — Nice to Have
15. Set up Alembic migrations for production schema management
16. Add E2E tests (Playwright)
17. Wire skills browser into the frontend UI
18. Add HPA and PDB to Kubernetes manifests
19. CI image push to registry
20. Add confirmation dialog before disconnect
