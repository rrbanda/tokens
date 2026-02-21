"""LLM-as-judge quality scoring for benchmark responses."""

import logging

import httpx

from app.config import get_config
from app.services.analyzer import _extract_json

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(60.0, connect=10.0)

JUDGE_PROMPT = """You are a strict quality evaluator for LLM responses.

## Task
Rate the quality of the response to the given prompt on a scale of 1-10.

## Scoring Criteria
- **Accuracy** (1-10): Is the response factually correct and relevant?
- **Completeness** (1-10): Does it fully address the prompt?
- **Conciseness** (1-10): Is it appropriately concise without unnecessary verbosity?

## Prompt
{prompt}

## Instructions Given to the Model
{instructions}

## Model Response
{response}

{reference_section}

## Output Format
Respond with ONLY this JSON (no markdown):
{{"score": <1-10 overall score>, "reasoning": "<1-2 sentence explanation>"}}"""


async def score_response(
    prompt: str,
    instructions: str,
    response_text: str,
    reference_output: str = "",
    server_url: str = "",
    model: str = "",
) -> tuple[float | None, str]:
    """Score a single response using a judge LLM.

    If server_url and model are provided, use them directly (user-selected judge).
    Otherwise fall back to the optimizer LLM from config.yaml.
    """
    config = get_config()

    judge_server = server_url or config.optimizer.server_url
    judge_model = model or config.optimizer.model
    if not judge_server or not judge_model:
        return None, ""

    reference_section = ""
    if reference_output:
        reference_section = f"## Reference Answer (Golden Output)\n{reference_output}\n\nCompare the model response against this reference."

    judge_input = JUDGE_PROMPT.format(
        prompt=prompt,
        instructions=instructions or "(none)",
        response=response_text[:2000],
        reference_section=reference_section,
    )

    body = {
        "model": judge_model,
        "input": judge_input,
        "instructions": "You are a quality evaluator. Respond only with valid JSON.",
        "stream": False,
        "store": False,
        "temperature": 0.1,
    }

    ssl = config.security.ssl_verify
    try:
        async with httpx.AsyncClient(verify=ssl, timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{judge_server}/v1/openai/v1/responses",
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

            text = ""
            for item in data.get("output", []):
                if item.get("type") == "message":
                    for part in item.get("content", []):
                        if part.get("type") == "output_text":
                            text += part.get("text", "")

            if not text:
                return None, ""

            result = _extract_json(text)
            if result and "score" in result:
                score = float(result["score"])
                score = max(1.0, min(10.0, score))
                return score, result.get("reasoning", "")

            return None, ""
    except Exception as e:
        logger.warning("Quality scoring failed: %s", e)
        return None, ""


async def score_benchmark_results(
    results: list[dict],
    instructions: str,
    prompts_with_refs: list[dict],
) -> list[tuple[float | None, str]]:
    """Score all results. Returns list of (score, reasoning) tuples."""
    import asyncio

    tasks = []
    for i, r in enumerate(results):
        if r.get("error"):
            tasks.append(asyncio.coroutine(lambda: (None, ""))())
            continue
        ref = prompts_with_refs[i].get("reference_output", "") if i < len(prompts_with_refs) else ""
        tasks.append(score_response(
            prompt=r.get("prompt", ""),
            instructions=instructions,
            response_text=r.get("response_text", ""),
            reference_output=ref,
        ))

    return await asyncio.gather(*tasks)
