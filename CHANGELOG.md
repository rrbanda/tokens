# Changelog

All notable changes to Promptly will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Multi-provider support: Llama Stack and OpenAI-compatible connectors
- Benchmark engine with multi-run averaging and statistical analysis (std dev, p50/p95 latency)
- AI-powered post-benchmark assessment (optimize/review/efficient verdict)
- AI-powered optimization with skills-grounded suggestions and revised instructions
- LLM-as-judge quality scoring with optional reference output comparison
- Before/after ROI comparison when applying optimized instructions
- Agent trace upload and analysis (simple, OpenTelemetry, LangSmith formats)
- AI-powered trace optimization suggestions
- Cost projection tab with built-in provider pricing data
- Custom pricing model management
- Benchmark run persistence (SQLite for dev, PostgreSQL for production)
- History tab with paginated benchmark run browser
- Dark mode with localStorage persistence
- Goose-compatible skills system (instruction-optimizer, token-efficiency, tool-use-patterns, agent-trace-patterns)
- Optional API key authentication
- Rate limiting on expensive endpoints (slowapi)
- SSRF protection with configurable blocked URL patterns
- Path traversal prevention in skills endpoint
- Structured JSON logging (python-json-logger)
- Prometheus metrics endpoint (/metrics)
- Optional OpenTelemetry tracing
- Request ID middleware (X-Request-ID)
- Multi-stage Docker build (UBI9 Node 20 + Python 3.11)
- Docker Compose setup with PostgreSQL
- Kustomize-based Kubernetes/OpenShift deployment manifests
- GitHub Actions CI (lint, test, build)
- Backend tests (routers, URL validator, skills manager, analyzer, stream handler)
- Frontend tests (BenchmarkResults, ErrorBoundary, SkillsList)
- Error boundary wrapping the React app
