"""Connector for any OpenAI-compatible API (OpenAI, Anthropic via proxy, Azure, vLLM, TGI, Ollama, etc.)."""

import logging
import time
from collections.abc import AsyncGenerator

import httpx

from app.config import get_config
from app.connectors.base import ProviderConnector
from app.models.schemas import InferenceResult, ModelInfo, TokenUsage, ToolInfo

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def _ssl_verify() -> bool | str:
    return get_config().security.ssl_verify


class OpenAICompatConnector(ProviderConnector):
    """Connector for servers exposing the standard OpenAI /v1/chat/completions API."""

    async def check_health(self, server_url: str) -> dict:
        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            try:
                resp = await client.get(f"{server_url}/v1/models")
                if resp.status_code < 500:
                    return {"status": "ok", "healthy": True}
                return {"status": "error", "healthy": False, "error": "Server returned error"}
            except Exception as e:
                logger.warning("Health check failed for %s: %s", server_url, e)
                return {"status": "unreachable", "healthy": False, "error": "Server is unreachable"}

    async def discover_models(self, server_url: str) -> list[ModelInfo]:
        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            models: list[ModelInfo] = []
            try:
                resp = await client.get(f"{server_url}/v1/models")
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("data", []):
                    model_id = m.get("id", "")
                    if model_id:
                        models.append(ModelInfo(
                            id=model_id,
                            display_name=model_id,
                            provider=m.get("owned_by", ""),
                        ))
            except Exception as e:
                logger.warning("Model discovery failed for %s: %s", server_url, e)
            return models

    async def discover_tools(self, server_url: str) -> list[ToolInfo]:
        return []

    async def run_inference(
        self,
        server_url: str,
        model_id: str,
        input_text: str,
        instructions: str = "",
        temperature: float | None = None,
        max_infer_iters: int | None = None,
    ) -> InferenceResult:
        start = time.monotonic()
        messages = []
        if instructions:
            messages.append({"role": "system", "content": instructions})
        messages.append({"role": "user", "content": input_text})

        body: dict = {
            "model": model_id,
            "messages": messages,
            "stream": False,
        }
        if temperature is not None:
            body["temperature"] = temperature

        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            try:
                resp = await client.post(f"{server_url}/v1/chat/completions", json=body)
                resp.raise_for_status()
                data = resp.json()

                text = ""
                choices = data.get("choices", [])
                if choices:
                    text = choices[0].get("message", {}).get("content", "")

                usage_raw = data.get("usage", {})
                usage = TokenUsage(
                    input_tokens=usage_raw.get("prompt_tokens", 0),
                    output_tokens=usage_raw.get("completion_tokens", 0),
                    total_tokens=usage_raw.get("total_tokens", 0),
                )

                elapsed = (time.monotonic() - start) * 1000
                return InferenceResult(
                    model_id=model_id,
                    display_name=model_id,
                    response_text=text,
                    usage=usage,
                    latency_ms=round(elapsed, 1),
                    api_used="chat_completions",
                )
            except Exception as e:
                elapsed = (time.monotonic() - start) * 1000
                logger.exception("Inference failed for %s", model_id)
                return InferenceResult(
                    model_id=model_id,
                    display_name=model_id,
                    error=str(e),
                    latency_ms=round(elapsed, 1),
                )

    async def stream_inference(
        self,
        server_url: str,
        model_id: str,
        input_text: str,
        instructions: str = "",
        temperature: float | None = None,
        max_infer_iters: int | None = None,
    ) -> AsyncGenerator[dict, None]:
        start = time.monotonic()
        messages = []
        if instructions:
            messages.append({"role": "system", "content": instructions})
        messages.append({"role": "user", "content": input_text})

        body: dict = {
            "model": model_id,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if temperature is not None:
            body["temperature"] = temperature

        full_text = ""
        usage_found = None

        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            try:
                from app.services.stream_handler import (
                    extract_text_delta_from_chat_chunk,
                    extract_usage_from_chat_chunk,
                    parse_sse_lines,
                )

                async with client.stream(
                    "POST",
                    f"{server_url}/v1/chat/completions",
                    json=body,
                    headers={"Accept": "text/event-stream"},
                ) as resp:
                    resp.raise_for_status()
                    async for event in parse_sse_lines(resp.aiter_lines()):
                        if event.get("type") == "__done__":
                            break
                        text_delta = extract_text_delta_from_chat_chunk(event)
                        if text_delta:
                            full_text += text_delta
                            yield {"type": "text_delta", "delta": text_delta}
                        usage = extract_usage_from_chat_chunk(event)
                        if usage:
                            usage_found = usage
            except Exception as e:
                elapsed = (time.monotonic() - start) * 1000
                yield {"type": "error", "error": str(e), "latency_ms": round(elapsed, 1)}
                return

        elapsed = (time.monotonic() - start) * 1000
        yield {
            "type": "complete",
            "response_text": full_text,
            "usage": usage_found or {},
            "latency_ms": round(elapsed, 1),
            "api_used": "chat_completions",
        }
