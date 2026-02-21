import json
import logging
import re

import httpx

from app.config import get_config
from app.models.schemas import (
    BenchmarkResponse,
    OptimizationRequest,
    OptimizationResponse,
    Suggestion,
)
from app.services.skills_manager import get_skills_manager

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(180.0, connect=10.0)


def _ssl_verify() -> bool | str:
    return get_config().security.ssl_verify

META_PROMPT = """You are an expert LLM optimization consultant. Your job is to analyze benchmark results from an LLM agent and suggest concrete improvements to reduce token usage while maintaining or improving response quality.

## Optimization Knowledge Base

The following best practices are loaded from optimization skills:

{skills_content}

## Current Agent Configuration

- **Server**: {server_url}
- **Model**: {model_id}
- **Instructions**: 
```
{instructions}
```
- **Temperature**: {temperature}

## Benchmark Results

Total prompts tested: {num_prompts}
Aggregate token usage:
- Input tokens: {total_input}
- Output tokens: {total_output}
- Total tokens: {total_tokens}
- Average latency: {avg_latency}ms

### Per-Prompt Results

{per_prompt_results}

## Your Task

Analyze the above configuration and benchmark results. Provide:

1. **Specific suggestions** for reducing token usage, organized by category (instructions, model, temperature, tools, prompts).
2. For instruction improvements, provide a **complete revised version** of the instructions.
3. For each suggestion, estimate the potential token savings (e.g., "~20% reduction in input tokens").
4. Rate the risk level of each change (Low/Medium/High).

Respond in the following JSON format ONLY (no markdown wrapping):
{{
  "suggestions": [
    {{
      "category": "instructions|model|temperature|tools|prompts",
      "title": "Short title",
      "description": "Detailed explanation",
      "estimated_token_savings": "e.g., ~30% input token reduction",
      "suggested_change": "The concrete change to make",
      "revised_instructions": "Full revised instructions text (only for category=instructions)"
    }}
  ],
  "revised_instructions": "Complete optimized instructions (combining all instruction-related suggestions)",
  "summary": "2-3 sentence executive summary of findings"
}}"""


def _extract_json(text: str) -> dict | None:
    """Robustly extract a JSON object from LLM response text."""
    text = text.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find the outermost { ... } block
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    end = start
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    if depth != 0:
        # Incomplete JSON — try to close it
        candidate = text[start:] + "}" * depth
    else:
        candidate = text[start : end + 1]

    # Remove trailing commas before } or ]
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def _format_per_prompt_results(benchmark: BenchmarkResponse) -> str:
    lines: list[str] = []
    for i, r in enumerate(benchmark.results, 1):
        status = "OK" if r.error is None else f"ERROR: {r.error}"
        lines.append(
            f"{i}. Prompt: \"{r.prompt[:100]}{'...' if len(r.prompt) > 100 else ''}\"\n"
            f"   Status: {status} | Input: {r.usage.input_tokens} | Output: {r.usage.output_tokens} | "
            f"Total: {r.usage.total_tokens} | Latency: {r.latency_ms}ms | API: {r.api_used}\n"
            f"   Response preview: \"{r.response_text[:150]}{'...' if len(r.response_text) > 150 else ''}\""
        )
    return "\n\n".join(lines)


async def analyze(req: OptimizationRequest) -> OptimizationResponse:
    """Use the configured optimizer LLM to analyze benchmark results and generate suggestions."""
    config = get_config()

    if not config.optimizer.server_url or not config.optimizer.model:
        return OptimizationResponse(
            error="Optimizer LLM not configured. Set optimizer.server_url and optimizer.model in config.yaml."
        )

    skills_content = get_skills_manager().load_all_skill_content()
    benchmark = req.benchmark_results

    prompt = META_PROMPT.format(
        skills_content=skills_content,
        server_url=req.server_url,
        model_id=req.model_id,
        instructions=req.instructions,
        temperature=benchmark.temperature or "default",
        num_prompts=len(benchmark.results),
        total_input=benchmark.aggregate.input_tokens,
        total_output=benchmark.aggregate.output_tokens,
        total_tokens=benchmark.aggregate.total_tokens,
        avg_latency=benchmark.avg_latency_ms,
        per_prompt_results=_format_per_prompt_results(benchmark),
    )

    body = {
        "model": config.optimizer.model,
        "input": prompt,
        "instructions": "You are an LLM optimization expert. Respond only with valid JSON.",
        "stream": False,
        "store": False,
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(verify=_ssl_verify(), timeout=TIMEOUT) as client:
        try:
            resp = await client.post(
                f"{config.optimizer.server_url}/v1/openai/v1/responses",
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

            response_text = ""
            for item in data.get("output", []):
                if item.get("type") == "message":
                    for part in item.get("content", []):
                        if part.get("type") == "output_text":
                            response_text += part.get("text", "")

            if not response_text:
                return OptimizationResponse(error="Optimizer returned empty response")

            result = _extract_json(response_text)
            if result is None:
                logger.warning("Failed to parse optimizer JSON. Raw (first 800 chars): %s", response_text[:800])
                return OptimizationResponse(
                    error="Failed to parse optimizer response as JSON",
                    summary=response_text[:500],
                )

            suggestions: list[Suggestion] = []
            for s in result.get("suggestions", []):
                try:
                    suggestions.append(Suggestion(**s))
                except Exception as val_err:
                    logger.warning("Skipping malformed suggestion: %s — %s", s, val_err)

            return OptimizationResponse(
                suggestions=suggestions,
                revised_instructions=result.get("revised_instructions", ""),
                summary=result.get("summary", ""),
            )

        except Exception as e:
            logger.exception("Optimization analysis failed")
            return OptimizationResponse(error=str(e))
