import logging
import time
from collections.abc import AsyncGenerator

import httpx

from app.config import get_config
from app.connectors.base import ProviderConnector
from app.models.schemas import InferenceResult, ModelInfo, TokenUsage, ToolInfo
from app.services.stream_handler import (
    extract_text_delta_from_chat_chunk,
    extract_text_delta_from_responses_event,
    extract_usage_from_chat_chunk,
    extract_usage_from_responses_event,
    parse_sse_lines,
)

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def _ssl_verify() -> bool | str:
    return get_config().security.ssl_verify


class LlamaStackConnector(ProviderConnector):
    """Connector for Llama Stack servers using Responses API with Chat Completions fallback."""

    async def check_health(self, server_url: str) -> dict:
        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            try:
                resp = await client.get(f"{server_url}/v1/health")
                data = resp.json()
                return {"status": data.get("status", "ok"), "healthy": True}
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
                model_list = data.get("data", data) if isinstance(data, dict) else data
                if isinstance(model_list, list):
                    for m in model_list:
                        model_id = m.get("id", m.get("identifier", ""))
                        if model_id:
                            models.append(ModelInfo(
                                id=model_id,
                                display_name=m.get("id", model_id),
                                provider=m.get("provider_id", ""),
                                metadata=m.get("metadata", {}),
                            ))
            except Exception as e:
                logger.warning("Model discovery failed for %s: %s", server_url, e)
                try:
                    resp = await client.get(f"{server_url}/v1/openai/v1/models")
                    resp.raise_for_status()
                    data = resp.json()
                    for m in data.get("data", []):
                        model_id = m.get("id", "")
                        if model_id:
                            models.append(ModelInfo(
                                id=model_id,
                                display_name=model_id,
                            ))
                except Exception:
                    logger.warning("OpenAI model discovery also failed for %s", server_url)
            return models

    async def discover_tools(self, server_url: str) -> list[ToolInfo]:
        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            tools: list[ToolInfo] = []
            try:
                resp = await client.get(f"{server_url}/v1/tool-runtime/list-tools")
                resp.raise_for_status()
                data = resp.json()
                tool_list = data if isinstance(data, list) else data.get("data", [])
                for t in tool_list:
                    tools.append(ToolInfo(
                        name=t.get("tool_name", t.get("name", "")),
                        description=t.get("description", ""),
                        toolgroup=t.get("toolgroup_id", ""),
                    ))
            except Exception as e:
                logger.debug("Tool discovery failed for %s: %s", server_url, e)
            return tools

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
        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            try:
                text, usage, api_used = await self._call_responses_api(
                    client, server_url, model_id, input_text,
                    instructions, temperature, max_infer_iters,
                )
                if usage is None or usage.total_tokens == 0:
                    logger.info("Responses API returned no usage, falling back to Chat Completions")
                    text, usage, api_used = await self._call_chat_completions_api(
                        client, server_url, model_id, input_text,
                        instructions, temperature,
                    )

                elapsed = (time.monotonic() - start) * 1000
                return InferenceResult(
                    model_id=model_id,
                    display_name=model_id,
                    response_text=text,
                    usage=usage or TokenUsage(),
                    latency_ms=round(elapsed, 1),
                    api_used=api_used,
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
        body: dict = {
            "model": model_id,
            "input": input_text,
            "stream": True,
            "store": False,
        }
        if instructions:
            body["instructions"] = instructions
        if temperature is not None:
            body["temperature"] = temperature
        if max_infer_iters is not None:
            body["max_infer_iters"] = max_infer_iters

        usage_found = None
        full_text = ""

        async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{server_url}/v1/openai/v1/responses",
                    json=body,
                    headers={"Accept": "text/event-stream"},
                ) as resp:
                    resp.raise_for_status()
                    async for event in parse_sse_lines(resp.aiter_lines()):
                        if event.get("type") == "__done__":
                            break
                        text_delta = extract_text_delta_from_responses_event(event)
                        if text_delta:
                            full_text += text_delta
                            yield {"type": "text_delta", "delta": text_delta}
                        usage = extract_usage_from_responses_event(event)
                        if usage:
                            usage_found = usage
            except Exception as e:
                elapsed = (time.monotonic() - start) * 1000
                yield {"type": "error", "error": str(e), "latency_ms": round(elapsed, 1)}
                return

        if usage_found is None:
            try:
                async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
                    async with client.stream(
                        "POST",
                        f"{server_url}/v1/openai/v1/chat/completions",
                        json={
                            "model": model_id,
                            "messages": (
                                ([{"role": "system", "content": instructions}] if instructions else [])
                                + [{"role": "user", "content": input_text}]
                            ),
                            "stream": True,
                            "stream_options": {"include_usage": True},
                            **({"temperature": temperature} if temperature is not None else {}),
                        },
                        headers={"Accept": "text/event-stream"},
                    ) as resp:
                        resp.raise_for_status()
                        full_text = ""
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
            "api_used": "responses" if usage_found else "chat_completions",
        }

    async def _call_responses_api(
        self,
        client: httpx.AsyncClient,
        server_url: str,
        model_id: str,
        input_text: str,
        instructions: str,
        temperature: float | None,
        max_infer_iters: int | None,
    ) -> tuple[str, TokenUsage | None, str]:
        body: dict = {
            "model": model_id,
            "input": input_text,
            "stream": False,
            "store": False,
        }
        if instructions:
            body["instructions"] = instructions
        if temperature is not None:
            body["temperature"] = temperature
        if max_infer_iters is not None:
            body["max_infer_iters"] = max_infer_iters

        resp = await client.post(f"{server_url}/v1/openai/v1/responses", json=body)
        resp.raise_for_status()
        data = resp.json()

        text = ""
        output = data.get("output", [])
        for item in output:
            if item.get("type") == "message":
                for part in item.get("content", []):
                    if part.get("type") == "output_text":
                        text += part.get("text", "")

        usage_raw = data.get("usage")
        usage = None
        if usage_raw:
            usage = TokenUsage(
                input_tokens=usage_raw.get("input_tokens", 0),
                output_tokens=usage_raw.get("output_tokens", 0),
                total_tokens=usage_raw.get("total_tokens", 0),
                input_tokens_details=usage_raw.get("input_tokens_details"),
                output_tokens_details=usage_raw.get("output_tokens_details"),
            )

        return text, usage, "responses"

    async def _call_chat_completions_api(
        self,
        client: httpx.AsyncClient,
        server_url: str,
        model_id: str,
        input_text: str,
        instructions: str,
        temperature: float | None,
    ) -> tuple[str, TokenUsage | None, str]:
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

        resp = await client.post(f"{server_url}/v1/openai/v1/chat/completions", json=body)
        resp.raise_for_status()
        data = resp.json()

        text = ""
        choices = data.get("choices", [])
        if choices:
            text = choices[0].get("message", {}).get("content", "")

        usage_raw = data.get("usage")
        usage = None
        if usage_raw:
            usage = TokenUsage(
                input_tokens=usage_raw.get("prompt_tokens", 0),
                output_tokens=usage_raw.get("completion_tokens", 0),
                total_tokens=usage_raw.get("total_tokens", 0),
            )

        return text, usage, "chat_completions"


_connector = LlamaStackConnector()


def get_connector() -> LlamaStackConnector:
    return _connector
