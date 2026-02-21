import asyncio
import logging
import math
import time

from app.connectors import get_connector
from app.models.schemas import (
    BenchmarkRequest,
    BenchmarkResponse,
    BenchmarkTestResult,
    TokenUsage,
)

logger = logging.getLogger(__name__)


def _percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    return sorted_values[f] * (c - k) + sorted_values[c] * (k - f)


async def run_single_prompt(
    server_url: str,
    model_id: str,
    prompt: str,
    instructions: str,
    temperature: float | None,
    max_infer_iters: int | None,
    provider: str = "llama_stack",
) -> BenchmarkTestResult:
    connector = get_connector(provider)
    result = await connector.run_inference(
        server_url=server_url,
        model_id=model_id,
        input_text=prompt,
        instructions=instructions,
        temperature=temperature,
        max_infer_iters=max_infer_iters,
    )
    return BenchmarkTestResult(
        prompt=prompt,
        response_text=result.response_text,
        usage=result.usage,
        latency_ms=result.latency_ms,
        api_used=result.api_used,
        error=result.error,
    )


async def _run_single_prompt_multi(
    server_url: str,
    model_id: str,
    prompt: str,
    instructions: str,
    temperature: float | None,
    max_infer_iters: int | None,
    provider: str,
    num_runs: int,
) -> BenchmarkTestResult:
    """Run a prompt num_runs times and return averaged result."""
    if num_runs <= 1:
        return await run_single_prompt(server_url, model_id, prompt, instructions, temperature, max_infer_iters, provider)

    runs = []
    for _ in range(num_runs):
        r = await run_single_prompt(server_url, model_id, prompt, instructions, temperature, max_infer_iters, provider)
        runs.append(r)

    successful = [r for r in runs if r.error is None]
    if not successful:
        return runs[0]

    avg_input = sum(r.usage.input_tokens for r in successful) / len(successful)
    avg_output = sum(r.usage.output_tokens for r in successful) / len(successful)
    avg_total = sum(r.usage.total_tokens for r in successful) / len(successful)
    avg_latency = sum(r.latency_ms for r in successful) / len(successful)

    return BenchmarkTestResult(
        prompt=prompt,
        response_text=successful[-1].response_text,
        usage=TokenUsage(
            input_tokens=round(avg_input),
            output_tokens=round(avg_output),
            total_tokens=round(avg_total),
        ),
        latency_ms=round(avg_latency, 1),
        api_used=successful[-1].api_used,
    )


async def run_benchmark(req: BenchmarkRequest) -> BenchmarkResponse:
    """Execute all prompts against the specified configuration and aggregate results."""
    start = time.monotonic()

    tasks = [
        _run_single_prompt_multi(
            server_url=req.server_url,
            model_id=req.model_id,
            prompt=p.input,
            instructions=req.instructions,
            temperature=req.temperature,
            max_infer_iters=req.max_infer_iters,
            provider=req.provider,
            num_runs=req.num_runs,
        )
        for p in req.prompts
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    results: list[BenchmarkTestResult] = []
    for i, r in enumerate(raw_results):
        if isinstance(r, BaseException):
            logger.warning("Prompt %d failed with exception: %s", i, r)
            results.append(BenchmarkTestResult(
                prompt=req.prompts[i].input,
                error=str(r),
            ))
        else:
            results.append(r)

    if req.score_quality:
        try:
            from app.services.quality_scorer import score_response

            judge_server = req.server_url if req.judge_model_id else ""
            judge_model = req.judge_model_id

            scoring_tasks = []
            for i, r in enumerate(results):
                if r.error is not None:
                    scoring_tasks.append(_noop_score())
                else:
                    ref = req.prompts[i].reference_output if i < len(req.prompts) else ""
                    scoring_tasks.append(score_response(
                        prompt=r.prompt,
                        instructions=req.instructions,
                        response_text=r.response_text,
                        reference_output=ref,
                        server_url=judge_server,
                        model=judge_model,
                    ))
            scores = await asyncio.gather(*scoring_tasks)
            for i, (score, reasoning) in enumerate(scores):
                results[i].quality_score = score
                results[i].quality_reasoning = reasoning
        except Exception as e:
            logger.warning("Quality scoring failed: %s", e)

    successful = [r for r in results if r.error is None]
    total_input = sum(r.usage.input_tokens for r in successful)
    total_output = sum(r.usage.output_tokens for r in successful)
    total_tokens = sum(r.usage.total_tokens for r in successful)
    total_latency = sum(r.latency_ms for r in results)
    avg_latency = total_latency / len(successful) if successful else 0

    latencies = sorted(r.latency_ms for r in successful)
    token_counts = [float(r.usage.total_tokens) for r in successful]

    std_dev = 0.0
    if len(token_counts) > 1:
        mean = sum(token_counts) / len(token_counts)
        std_dev = math.sqrt(sum((t - mean) ** 2 for t in token_counts) / (len(token_counts) - 1))

    quality_scores = [r.quality_score for r in successful if r.quality_score is not None]
    avg_quality = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None

    elapsed = (time.monotonic() - start) * 1000

    return BenchmarkResponse(
        server_url=req.server_url,
        model_id=req.model_id,
        instructions=req.instructions,
        temperature=req.temperature,
        results=results,
        aggregate=TokenUsage(
            input_tokens=total_input,
            output_tokens=total_output,
            total_tokens=total_tokens if total_tokens > 0 else total_input + total_output,
        ),
        total_latency_ms=round(elapsed, 1),
        avg_latency_ms=round(avg_latency, 1),
        min_latency_ms=round(latencies[0], 1) if latencies else 0,
        max_latency_ms=round(latencies[-1], 1) if latencies else 0,
        p50_latency_ms=round(_percentile(latencies, 50), 1),
        p95_latency_ms=round(_percentile(latencies, 95), 1),
        std_dev_tokens=round(std_dev, 1),
        avg_quality_score=avg_quality,
    )


async def _noop_score() -> tuple[None, str]:
    return None, ""
