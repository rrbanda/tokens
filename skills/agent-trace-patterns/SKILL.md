---
name: agent-trace-patterns
description: Optimization patterns for multi-turn agent workflows including context management, tool efficiency, and step reduction
---

# Agent Trace Optimization Patterns

## Context Window Management

### Sliding Window
Keep only the most recent N turns in the conversation history. Older turns are either dropped or summarized into a single condensed message. This prevents linear context growth.

**When to use**: Agents that run 10+ turns per task. Context typically grows 500-2000 tokens per turn.

**Implementation**: After every K turns, summarize turns 1..K into a single message and replace them. Keep the system prompt, summary, and last K turns.

**Expected savings**: 40-70% reduction in input tokens for long-running agents.

### Progressive Summarization
Instead of keeping full message history, maintain a running summary that grows logarithmically rather than linearly. After each agent step, compress the previous summary + new turn into an updated summary.

**When to use**: Agents where early context matters but exact wording doesn't.

**Expected savings**: 50-80% input token reduction for 10+ turn conversations.

### Selective Retrieval
Don't pass all history to every LLM call. Only include turns that are relevant to the current step. Use embeddings or keywords to select which history items to include.

**When to use**: Agents with diverse sub-tasks where most history is irrelevant to the current step.

## Tool Definition Optimization

### Schema Compression
Tool definitions (function schemas) are included in every LLM call. If you have 20 tools with detailed descriptions, that can be 3000-5000 tokens before the user even speaks.

**Strategies**:
- Remove verbose descriptions; keep only parameter names and types
- Use abbreviated parameter descriptions (1 line, not paragraphs)
- Remove optional parameters that are rarely used
- Group related tools under a single tool with a "action" parameter

**Expected savings**: 30-60% reduction in tool definition tokens.

### Selective Tool Loading
Don't give the agent all tools on every turn. Based on the current task phase, load only the relevant tools.

**Example**: A coding agent doesn't need web search tools while writing code, and doesn't need code execution tools while searching.

**Expected savings**: 20-50% input token reduction per call.

### Compact Tool Results
Tool results often contain more data than the LLM needs. Truncate, filter, or summarize tool outputs before passing them back.

**Strategies**:
- Limit search results to top 3 instead of top 10
- Return only relevant fields from API responses
- Summarize long documents rather than passing full text
- Set max character limits on tool output

**Expected savings**: 20-40% reduction in tool-related tokens.

## Step Reduction Patterns

### Plan-Then-Execute
Instead of ReAct (think-act-observe loops), have the agent create a complete plan first, then execute all steps. This avoids the token overhead of planning in every step.

**When to use**: Tasks with predictable workflows.

**Expected savings**: 30-50% fewer LLM calls, proportional token reduction.

### Batch Tool Calls
When the agent needs to make multiple independent tool calls, batch them in a single turn rather than one-per-turn. Modern APIs support parallel tool calling.

**When to use**: Agents that frequently make 2-3 independent tool calls in sequence.

**Expected savings**: Eliminates 1 LLM round-trip per batched call.

### Early Termination
Add explicit conditions for the agent to stop when the task is complete, rather than continuing to verify or elaborate. Many agents waste 2-3 extra turns confirming what they already know.

**When to use**: Agents that consistently use more turns than necessary.

## Output Control

### Intermediate Brevity
Agent intermediate steps (thinking, tool call reasoning) don't need to be verbose. Only the final response to the user needs full detail.

**Implementation**: Use different system prompts for intermediate vs. final steps, or add "be concise in your reasoning" to the system prompt.

**Expected savings**: 20-40% output token reduction.

### Structured Output
Request JSON or structured format for intermediate steps. This forces conciseness and makes parsing reliable.

### Max Token Limits
Set `max_tokens` on intermediate LLM calls to prevent runaway responses. A planning step rarely needs more than 500 tokens.

## Measurement Best Practices

### Per-Step Tracking
Always measure tokens per step, not just total. This reveals which steps are expensive and which are cheap.

### Context Growth Curve
Plot cumulative tokens over steps. A healthy pattern is sub-linear growth. Linear or super-linear growth indicates missing context management.

### Tool Overhead Ratio
Calculate what percentage of total tokens go to tool definitions + results vs. actual reasoning. If tool overhead exceeds 40%, focus optimization there first.
