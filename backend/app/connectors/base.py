from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from app.models.schemas import InferenceResult, ModelInfo, ToolInfo


class ProviderConnector(ABC):
    """Base class for LLM provider connectors."""

    @abstractmethod
    async def check_health(self, server_url: str) -> dict:
        """Check if the server is reachable."""

    @abstractmethod
    async def discover_models(self, server_url: str) -> list[ModelInfo]:
        """Discover available models on the server."""

    @abstractmethod
    async def discover_tools(self, server_url: str) -> list[ToolInfo]:
        """Discover available tools/toolgroups on the server."""

    @abstractmethod
    async def run_inference(
        self,
        server_url: str,
        model_id: str,
        input_text: str,
        instructions: str = "",
        temperature: float | None = None,
        max_infer_iters: int | None = None,
    ) -> InferenceResult:
        """Run non-streaming inference, returning text + token usage."""

    @abstractmethod
    async def stream_inference(
        self,
        server_url: str,
        model_id: str,
        input_text: str,
        instructions: str = "",
        temperature: float | None = None,
        max_infer_iters: int | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream inference, yielding SSE-compatible events."""
