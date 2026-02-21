from app.connectors.base import ProviderConnector
from app.connectors.llama_stack import LlamaStackConnector
from app.connectors.openai_compat import OpenAICompatConnector

_connectors: dict[str, ProviderConnector] = {
    "llama_stack": LlamaStackConnector(),
    "openai": OpenAICompatConnector(),
}


def get_connector(provider: str = "llama_stack") -> ProviderConnector:
    """Get a connector by provider name. Falls back to llama_stack."""
    return _connectors.get(provider, _connectors["llama_stack"])


__all__ = ["ProviderConnector", "LlamaStackConnector", "OpenAICompatConnector", "get_connector"]
