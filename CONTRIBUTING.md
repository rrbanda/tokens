# Contributing to Promptly

Thank you for your interest in contributing to Promptly! This guide explains how to set up a development environment, the coding standards we follow, and the process for submitting changes.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git

### Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR-ORG/promptly.git
cd promptly

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt

# Frontend
cd ../frontend
npm install
```

### Running Locally

```bash
# Terminal 1: Backend
cd backend
CONFIG_PATH=../config.yaml SKILLS_DIR=../skills uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies `/api` to `localhost:8080`.

### Running with Docker

```bash
docker compose up --build
# or
podman-compose up --build
```

## Making Changes

### Branch Naming

- `feature/description` — new features
- `fix/description` — bug fixes
- `docs/description` — documentation updates
- `refactor/description` — code refactoring

### Code Style

**Backend (Python)**
- Linted with [ruff](https://docs.astral.sh/ruff/)
- Type hints on all function signatures
- Async functions for all I/O operations
- Pydantic models for all API request/response schemas

**Frontend (TypeScript)**
- Linted with ESLint (strict TypeScript config)
- React functional components with hooks
- Tailwind CSS for styling (no CSS modules or styled-components)
- Types for all props and API contracts

### Testing

Run tests before submitting a PR:

```bash
# Backend
cd backend
pytest --tb=short -q

# Frontend
cd frontend
npm test
```

### Linting

```bash
# Backend
cd backend
pip install ruff
ruff check .

# Frontend
cd frontend
npm run lint
```

## Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Make your changes, following the coding standards above.
3. Add or update tests for any changed functionality.
4. Ensure all tests pass and linting is clean.
5. Write a clear PR description explaining what changed and why.
6. Submit the pull request.

### PR Checklist

- [ ] Tests pass (`pytest` and `npm test`)
- [ ] Linting is clean (`ruff check` and `npm run lint`)
- [ ] New features include tests
- [ ] Documentation is updated if needed
- [ ] No unrelated changes included

## Reporting Issues

- Use [GitHub Issues](https://github.com/YOUR-ORG/promptly/issues) to report bugs or request features
- Include steps to reproduce for bug reports
- Check existing issues before creating a new one

## Adding Optimization Skills

To contribute a new optimization skill:

1. Create a directory under `skills/` (e.g., `skills/my-skill/`)
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`) and markdown content
3. Skills are automatically loaded by the backend and injected into AI analysis

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
