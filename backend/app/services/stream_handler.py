import json
import logging
from collections.abc import AsyncIterator

logger = logging.getLogger(__name__)


async def parse_sse_lines(response_lines: AsyncIterator[str]):
    """Parse raw SSE lines from an httpx streaming response into events."""
    async for line in response_lines:
        line = line.strip()
        if not line or line.startswith(":"):
            continue
        if line.startswith("data: "):
            data_str = line[6:]
            if data_str == "[DONE]":
                yield {"type": "__done__"}
                return
            try:
                yield json.loads(data_str)
            except json.JSONDecodeError:
                logger.debug("Skipping unparseable SSE data: %s", data_str[:200])
                continue


def extract_usage_from_responses_event(event: dict) -> dict | None:
    """Extract usage from a Responses API SSE event (response.completed)."""
    if event.get("type") == "response.completed":
        response = event.get("response", {})
        return response.get("usage")
    return None


def extract_text_delta_from_responses_event(event: dict) -> str | None:
    """Extract text delta from a Responses API streaming event."""
    if event.get("type") == "response.output_text.delta":
        return event.get("delta", "")
    return None


def extract_usage_from_chat_chunk(chunk: dict) -> dict | None:
    """Extract usage from a Chat Completions streaming chunk (final chunk with usage)."""
    usage = chunk.get("usage")
    if usage:
        return {
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        }
    return None


def extract_text_delta_from_chat_chunk(chunk: dict) -> str | None:
    """Extract text delta from a Chat Completions streaming chunk."""
    choices = chunk.get("choices", [])
    if choices:
        delta = choices[0].get("delta", {})
        return delta.get("content")
    return None
