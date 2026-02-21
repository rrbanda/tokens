import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

os.environ["CONFIG_PATH"] = str(Path(__file__).parent.parent.parent / "config.yaml")
os.environ["SKILLS_DIR"] = str(Path(__file__).parent.parent.parent / "skills")
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"

from app.main import app  # noqa: E402
from app.connectors.llama_stack import LlamaStackConnector  # noqa: E402
from app.models.schemas import InferenceResult, ModelInfo, TokenUsage, ToolInfo  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_connector(monkeypatch):
    connector = MagicMock(spec=LlamaStackConnector)
    connector.check_health = AsyncMock(return_value={"status": "ok", "healthy": True})
    connector.discover_models = AsyncMock(return_value=[
        ModelInfo(id="test-model", display_name="Test Model", provider="test"),
    ])
    connector.discover_tools = AsyncMock(return_value=[
        ToolInfo(name="test-tool", description="A test tool"),
    ])
    connector.run_inference = AsyncMock(return_value=InferenceResult(
        model_id="test-model",
        display_name="Test Model",
        response_text="Hello world",
        usage=TokenUsage(input_tokens=10, output_tokens=5, total_tokens=15),
        latency_ms=100.0,
        api_used="responses",
    ))

    import app.connectors as connectors_mod
    monkeypatch.setattr(connectors_mod, "_connectors", {
        "llama_stack": connector,
        "openai": connector,
    })
    return connector
