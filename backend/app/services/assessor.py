"""Automatic post-benchmark assessment using skills knowledge base."""

import logging

import httpx

from app.config import get_config
from app.models.schemas import AssessmentRequest, AssessmentResponse, BenchmarkResponse
from app.services.analyzer import _extract_json
from app.services.skills_manager import get_skills_manager

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(60.0, connect=10.0)

ASSESSMENT_PROMPT = """You are an LLM cost optimization advisor. A user just ran a benchmark on their LLM agent.
Your job: analyze the results using the optimization knowledge base below and give a quick, honest verdict on whether they should optimize.

## Optimization Knowledge Base

{skills_content}

## Benchmark Results

- **Model**: {model_id}
- **Instructions (system prompt)**: {instructions}
- **Temperature**: {temperature}
- **Prompts tested**: {num_prompts}
- **Aggregate tokens**: {total_input} input + {total_output} output = {total_tokens} total
- **Avg tokens per prompt**: {avg_input} input + {avg_output} output
- **Avg latency**: {avg_latency}ms (min {min_latency}ms, max {max_latency}ms)
- **Token std deviation**: {std_dev}
- **Avg quality score**: {quality_score}

### Per-Prompt Breakdown
{per_prompt_summary}

## Your Task

Assess whether optimization is worthwhile. Consider:
1. Is the system prompt disproportionately large relative to user content?
2. Are output tokens reasonable for the task, or is the model being verbose?
3. Is there high token variance suggesting inconsistent response control?
4. Could a simpler prompt or lower temperature achieve similar quality?
5. Does the quality score (if available) suggest room for improvement?

Be honest — if the setup is already efficient, say so. Don't push optimization for its own sake.

Respond with ONLY this JSON (no markdown):
{{"verdict": "optimize|efficient|review", "confidence": "high|medium|low", "summary": "<1-2 sentence assessment>", "key_findings": ["<finding 1>", "<finding 2>", "<finding 3 (optional)>"], "estimated_savings_percent": <0-60 integer estimate>}}

Verdict meanings:
- "optimize": Clear inefficiencies found, optimization will meaningfully reduce costs
- "review": Some potential improvements, but setup is reasonable — optimization optional
- "efficient": Setup looks lean, optimization unlikely to yield significant savings"""


def _format_per_prompt_brief(benchmark: BenchmarkResponse) -> str:
    lines: list[str] = []
    for i, r in enumerate(benchmark.results, 1):
        quality = f", quality: {r.quality_score}/10" if r.quality_score is not None else ""
        lines.append(
            f"{i}. \"{r.prompt[:80]}{'...' if len(r.prompt) > 80 else ''}\" "
            f"→ {r.usage.input_tokens}in/{r.usage.output_tokens}out, "
            f"{r.latency_ms:.0f}ms{quality}"
        )
    return "\n".join(lines)


async def assess(req: AssessmentRequest) -> AssessmentResponse:
    """Run a quick, skills-grounded assessment of benchmark results."""
    config = get_config()

    benchmark = req.benchmark_results

    assess_server = req.server_url or config.optimizer.server_url
    assess_model = req.model_id or config.optimizer.model or benchmark.model_id
    if not assess_server or not assess_model:
        return AssessmentResponse(
            error="No LLM available for assessment. Configure optimizer in config.yaml or pass server_url/model_id."
        )
    num_prompts = len(benchmark.results) or 1
    avg_input = benchmark.aggregate.input_tokens / num_prompts
    avg_output = benchmark.aggregate.output_tokens / num_prompts

    skills_content = get_skills_manager().load_all_skill_content()

    quality_str = (
        f"{benchmark.avg_quality_score}/10"
        if benchmark.avg_quality_score is not None
        else "not measured"
    )

    prompt = ASSESSMENT_PROMPT.format(
        skills_content=skills_content,
        model_id=benchmark.model_id,
        instructions=benchmark.instructions[:500] or "(none)",
        temperature=benchmark.temperature or "default",
        num_prompts=num_prompts,
        total_input=benchmark.aggregate.input_tokens,
        total_output=benchmark.aggregate.output_tokens,
        total_tokens=benchmark.aggregate.total_tokens,
        avg_input=round(avg_input),
        avg_output=round(avg_output),
        avg_latency=benchmark.avg_latency_ms,
        min_latency=benchmark.min_latency_ms,
        max_latency=benchmark.max_latency_ms,
        std_dev=benchmark.std_dev_tokens,
        quality_score=quality_str,
        per_prompt_summary=_format_per_prompt_brief(benchmark),
    )

    body = {
        "model": assess_model,
        "input": prompt,
        "instructions": "You are an LLM cost advisor. Respond only with valid JSON.",
        "stream": False,
        "store": False,
        "temperature": 0.1,
    }

    ssl = config.security.ssl_verify
    try:
        async with httpx.AsyncClient(verify=ssl, timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{assess_server}/v1/openai/v1/responses",
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
                return AssessmentResponse(error="Assessment LLM returned empty response")

            result = _extract_json(text)
            if result is None:
                logger.warning("Failed to parse assessment JSON. Raw: %s", text[:500])
                return AssessmentResponse(error="Failed to parse assessment response")

            verdict = result.get("verdict", "review")
            if verdict not in ("optimize", "efficient", "review"):
                verdict = "review"

            confidence = result.get("confidence", "medium")
            if confidence not in ("high", "medium", "low"):
                confidence = "medium"

            savings = result.get("estimated_savings_percent", 0)
            try:
                savings = max(0, min(60, int(savings)))
            except (TypeError, ValueError):
                savings = 0

            return AssessmentResponse(
                verdict=verdict,
                confidence=confidence,
                summary=result.get("summary", ""),
                key_findings=result.get("key_findings", [])[:5],
                estimated_savings_percent=savings,
            )

    except Exception as e:
        logger.warning("Assessment failed: %s", e)
        return AssessmentResponse(error=str(e))
