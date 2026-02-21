"""Normalize trace data from various formats into our internal step representation."""

import logging

logger = logging.getLogger(__name__)


def normalize_simple_format(steps: list[dict]) -> list[dict]:
    """Our simple format is already normalized — just ensure total_tokens is set."""
    normalized = []
    for s in steps:
        inp = s.get("input_tokens", 0)
        out = s.get("output_tokens", 0)
        total = s.get("total_tokens", 0) or (inp + out)
        normalized.append({
            **s,
            "total_tokens": total,
        })
    return normalized


def normalize_opentelemetry_spans(raw_spans: list[dict]) -> list[dict]:
    """Convert OpenTelemetry/OpenInference spans into our internal step format.

    Expected span attributes (OpenInference convention):
      - name: span name (used as step description)
      - attributes.openinference.span.kind: "LLM" | "TOOL" | "CHAIN" | "AGENT"
      - attributes.llm.token_count.prompt: input tokens
      - attributes.llm.token_count.completion: output tokens
      - attributes.llm.input_messages: messages array
      - attributes.llm.output_messages: output messages
      - attributes.tool.name: tool name
      - start_time_unix_nano / end_time_unix_nano: timing
    """
    steps = []
    sorted_spans = sorted(raw_spans, key=lambda s: s.get("start_time_unix_nano", 0))

    for span in sorted_spans:
        attrs = span.get("attributes", {})
        span_kind = attrs.get("openinference.span.kind", "").upper()

        if span_kind not in ("LLM", "TOOL"):
            continue

        inp_tokens = attrs.get("llm.token_count.prompt", 0)
        out_tokens = attrs.get("llm.token_count.completion", 0)

        start_ns = span.get("start_time_unix_nano", 0)
        end_ns = span.get("end_time_unix_nano", 0)
        latency_ms = (end_ns - start_ns) / 1_000_000 if end_ns > start_ns else 0

        content = ""
        output = ""
        role = ""
        tool_name = ""

        if span_kind == "LLM":
            input_msgs = attrs.get("llm.input_messages", [])
            if input_msgs and isinstance(input_msgs, list):
                last_msg = input_msgs[-1] if input_msgs else {}
                content = last_msg.get("message.content", "")
                role = last_msg.get("message.role", "user")

            output_msgs = attrs.get("llm.output_messages", [])
            if output_msgs and isinstance(output_msgs, list):
                output = output_msgs[0].get("message.content", "") if output_msgs else ""

        elif span_kind == "TOOL":
            tool_name = attrs.get("tool.name", span.get("name", ""))
            content = attrs.get("input.value", "")
            output = attrs.get("output.value", "")

        steps.append({
            "step_type": "inference" if span_kind == "LLM" else "tool_call",
            "role": role,
            "content": content[:5000],
            "output": output[:5000],
            "tool_name": tool_name,
            "tool_calls": [],
            "input_tokens": int(inp_tokens),
            "output_tokens": int(out_tokens),
            "total_tokens": int(inp_tokens) + int(out_tokens),
            "latency_ms": round(latency_ms, 1),
            "metadata": {"span_name": span.get("name", ""), "trace_id": span.get("trace_id", "")},
        })

    return steps


def normalize_langsmith_runs(raw_runs: list[dict]) -> list[dict]:
    """Convert LangSmith run trace data into our internal step format.

    Expected fields per run:
      - run_type: "llm" | "tool" | "chain"
      - inputs / outputs
      - total_tokens / prompt_tokens / completion_tokens (or in extra.token_usage)
      - start_time / end_time (ISO strings)
    """
    steps = []
    sorted_runs = sorted(raw_runs, key=lambda r: r.get("start_time", ""))

    for run in sorted_runs:
        run_type = run.get("run_type", "").lower()
        if run_type not in ("llm", "tool"):
            continue

        token_usage = run.get("extra", {}).get("token_usage", {})
        inp_tokens = run.get("prompt_tokens", token_usage.get("prompt_tokens", 0))
        out_tokens = run.get("completion_tokens", token_usage.get("completion_tokens", 0))

        start = run.get("start_time", "")
        end = run.get("end_time", "")
        latency_ms = 0
        if start and end:
            try:
                from datetime import datetime
                s = datetime.fromisoformat(start.replace("Z", "+00:00"))
                e = datetime.fromisoformat(end.replace("Z", "+00:00"))
                latency_ms = (e - s).total_seconds() * 1000
            except (ValueError, TypeError):
                pass

        inputs = run.get("inputs", {})
        outputs = run.get("outputs", {})
        content = inputs.get("input", inputs.get("prompt", str(inputs)[:3000]))
        output_text = outputs.get("output", outputs.get("text", str(outputs)[:3000]))

        steps.append({
            "step_type": "inference" if run_type == "llm" else "tool_call",
            "role": "user" if run_type == "llm" else "",
            "content": str(content)[:5000],
            "output": str(output_text)[:5000],
            "tool_name": run.get("name", "") if run_type == "tool" else "",
            "tool_calls": [],
            "input_tokens": int(inp_tokens),
            "output_tokens": int(out_tokens),
            "total_tokens": int(inp_tokens) + int(out_tokens),
            "latency_ms": round(latency_ms, 1),
            "metadata": {"run_id": run.get("id", ""), "name": run.get("name", "")},
        })

    return steps


def normalize_trace(source_format: str, steps: list[dict]) -> list[dict]:
    """Route to the appropriate normalizer based on source format."""
    parsers = {
        "simple": normalize_simple_format,
        "opentelemetry": normalize_opentelemetry_spans,
        "langsmith": normalize_langsmith_runs,
    }
    parser = parsers.get(source_format, normalize_simple_format)
    return parser(steps)
