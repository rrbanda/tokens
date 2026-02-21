"""Analyze agent traces for token usage patterns and generate AI optimization suggestions."""

import logging

import httpx

from app.config import get_config
from app.services.analyzer import _extract_json
from app.services.skills_manager import get_skills_manager

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(180.0, connect=10.0)


def analyze_trace_steps(steps: list[dict]) -> dict:
    """Perform deterministic analysis of trace steps (no LLM call)."""
    total_input = 0
    total_output = 0
    total_tokens = 0
    total_latency = 0.0
    tool_tokens = 0
    inference_tokens = 0
    inference_count = 0
    cumulative = 0
    context_growth: list[int] = []
    tokens_per_step: list[dict] = []
    largest_step = {"step": 0, "tokens": 0, "type": ""}

    for i, s in enumerate(steps):
        inp = s.get("input_tokens", 0)
        out = s.get("output_tokens", 0)
        step_total = s.get("total_tokens", 0) or (inp + out)
        latency = s.get("latency_ms", 0)
        step_type = s.get("step_type", "inference")

        total_input += inp
        total_output += out
        total_tokens += step_total
        total_latency += latency
        cumulative += step_total
        context_growth.append(cumulative)

        tokens_per_step.append({
            "step": i,
            "type": step_type,
            "tokens": step_total,
            "input_tokens": inp,
            "output_tokens": out,
        })

        if step_total > largest_step["tokens"]:
            largest_step = {"step": i, "tokens": step_total, "type": step_type}

        if step_type == "tool_call":
            tool_tokens += step_total
        else:
            inference_tokens += step_total
            inference_count += 1

    tool_pct = round((tool_tokens / total_tokens * 100) if total_tokens > 0 else 0, 1)
    avg_per_inference = round(inference_tokens / inference_count, 1) if inference_count > 0 else 0

    suggestions = _generate_heuristic_suggestions(
        total_tokens=total_tokens,
        total_steps=len(steps),
        tool_tokens=tool_tokens,
        tool_pct=tool_pct,
        inference_count=inference_count,
        context_growth=context_growth,
        largest_step=largest_step,
        avg_per_inference=avg_per_inference,
    )

    return {
        "total_steps": len(steps),
        "total_tokens": total_tokens,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_latency_ms": round(total_latency, 1),
        "tokens_per_step": tokens_per_step,
        "context_growth": context_growth,
        "tool_overhead_tokens": tool_tokens,
        "tool_overhead_pct": tool_pct,
        "inference_tokens": inference_tokens,
        "largest_step": largest_step,
        "avg_tokens_per_inference": avg_per_inference,
        "suggestions": suggestions,
    }


def _generate_heuristic_suggestions(
    *,
    total_tokens: int,
    total_steps: int,
    tool_tokens: int,
    tool_pct: float,
    inference_count: int,
    context_growth: list[int],
    largest_step: dict,
    avg_per_inference: float,
) -> list[str]:
    """Generate rule-based suggestions without an LLM call."""
    suggestions = []

    if tool_pct > 40:
        suggestions.append(
            f"Tool calls consume {tool_pct}% of total tokens. Consider compressing tool schemas, "
            "reducing result sizes, or selectively loading only needed tools."
        )

    if len(context_growth) >= 3:
        first_third = context_growth[len(context_growth) // 3]
        last_third = context_growth[-1] - context_growth[2 * len(context_growth) // 3]
        if last_third > first_third * 2:
            suggestions.append(
                "Context tokens grow rapidly in later steps. Consider summarizing earlier "
                "conversation turns or implementing a sliding window to prevent context bloat."
            )

    if largest_step["tokens"] > total_tokens * 0.4 and total_steps > 2:
        suggestions.append(
            f"Step {largest_step['step']} ({largest_step['type']}) uses {largest_step['tokens']} tokens — "
            f"over 40% of total. Investigate whether this step can be split or its input/output reduced."
        )

    if inference_count > 5 and avg_per_inference > 1000:
        suggestions.append(
            f"Average of {avg_per_inference:.0f} tokens across {inference_count} inference calls. "
            "Consider requesting shorter intermediate responses (use 'be concise' in system prompt) "
            "and only expanding the final output."
        )

    if total_steps > 10:
        suggestions.append(
            f"This trace has {total_steps} steps. Evaluate if the agent can accomplish the task "
            "in fewer iterations by providing better initial context or more specific instructions."
        )

    if not suggestions:
        suggestions.append(
            "This trace looks reasonably efficient. Monitor for regressions as prompts or tools evolve."
        )

    return suggestions


TRACE_OPTIMIZATION_PROMPT = """You are an expert in optimizing multi-step AI agent workflows for token efficiency.

## Optimization Knowledge Base
{skills_content}

## Agent Trace Summary
- **Name**: {trace_name}
- **Total steps**: {total_steps}
- **Total tokens**: {total_tokens} (input: {total_input}, output: {total_output})
- **Total latency**: {total_latency_ms}ms
- **Tool call overhead**: {tool_overhead_tokens} tokens ({tool_overhead_pct}% of total)
- **Inference calls**: {inference_count} averaging {avg_tokens_per_inference} tokens each

## Per-Step Breakdown
{per_step_details}

## Context Growth Pattern
Cumulative tokens at each step: {context_growth}

## Your Task
Analyze this agent trace and provide optimization suggestions focused on:

1. **Context management** — Can earlier messages be summarized or pruned?
2. **Tool efficiency** — Are tool definitions bloated? Are tool results too verbose?
3. **Step reduction** — Can the agent achieve the same outcome in fewer steps?
4. **Output control** — Are intermediate responses unnecessarily verbose?
5. **Architecture** — Would a different agent pattern (ReAct vs. Plan-Execute) be more efficient?

Respond with ONLY this JSON (no markdown):
{{
  "suggestions": [
    {{
      "category": "context|tools|steps|output|architecture",
      "title": "Short title",
      "description": "Detailed explanation",
      "estimated_token_savings": "e.g., ~25% reduction",
      "suggested_change": "Concrete action to take"
    }}
  ],
  "revised_instructions": "If applicable, optimized system prompt",
  "summary": "2-3 sentence executive summary"
}}"""


async def optimize_agent_trace(trace_name: str, steps: list[dict]) -> dict:
    """Use the optimizer LLM to analyze a full agent trace and suggest improvements."""
    config = get_config()

    if not config.optimizer.server_url or not config.optimizer.model:
        return {"error": "Optimizer LLM not configured. Set optimizer.server_url and optimizer.model in config.yaml."}

    analysis = analyze_trace_steps(steps)
    skills_content = get_skills_manager().load_all_skill_content()

    inference_count = sum(1 for s in steps if s.get("step_type") != "tool_call")

    per_step_lines = []
    for i, s in enumerate(steps):
        step_type = s.get("step_type", "inference")
        tokens = s.get("total_tokens", 0) or (s.get("input_tokens", 0) + s.get("output_tokens", 0))
        content_preview = str(s.get("content", ""))[:120]
        output_preview = str(s.get("output", ""))[:120]
        tool_name = s.get("tool_name", "")
        extra = f" [{tool_name}]" if tool_name else ""
        per_step_lines.append(
            f"{i}. {step_type}{extra} | {s.get('input_tokens', 0)}in/{s.get('output_tokens', 0)}out = {tokens} tok | "
            f"{s.get('latency_ms', 0)}ms\n"
            f"   Input: \"{content_preview}{'...' if len(str(s.get('content', ''))) > 120 else ''}\"\n"
            f"   Output: \"{output_preview}{'...' if len(str(s.get('output', ''))) > 120 else ''}\""
        )

    prompt_text = TRACE_OPTIMIZATION_PROMPT.format(
        skills_content=skills_content,
        trace_name=trace_name,
        total_steps=len(steps),
        total_tokens=analysis["total_tokens"],
        total_input=analysis["total_input_tokens"],
        total_output=analysis["total_output_tokens"],
        total_latency_ms=analysis["total_latency_ms"],
        tool_overhead_tokens=analysis["tool_overhead_tokens"],
        tool_overhead_pct=analysis["tool_overhead_pct"],
        inference_count=inference_count,
        avg_tokens_per_inference=analysis["avg_tokens_per_inference"],
        per_step_details="\n\n".join(per_step_lines),
        context_growth=analysis["context_growth"],
    )

    body = {
        "model": config.optimizer.model,
        "input": prompt_text,
        "instructions": "You are an agent optimization expert. Respond only with valid JSON.",
        "stream": False,
        "store": False,
        "temperature": 0.3,
    }

    ssl = config.security.ssl_verify
    try:
        async with httpx.AsyncClient(verify=ssl, timeout=TIMEOUT) as client:
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
                return {"error": "Optimizer returned empty response", "analysis": analysis}

            result = _extract_json(response_text)
            if result is None:
                return {"error": "Failed to parse optimizer response", "analysis": analysis}

            return {
                "suggestions": result.get("suggestions", []),
                "revised_instructions": result.get("revised_instructions", ""),
                "summary": result.get("summary", ""),
                "analysis": analysis,
                "error": None,
            }

    except Exception as e:
        logger.warning("Trace optimization failed: %s", e)
        return {"error": str(e), "analysis": analysis}
