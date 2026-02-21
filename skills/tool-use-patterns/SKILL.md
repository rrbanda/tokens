---
name: tool-use-patterns
description: Best practices for optimizing tool usage in LLM agents to minimize unnecessary tool calls and reduce token overhead.
---

# Tool Use Optimization

You are an expert at analyzing how LLM agents use tools and identifying patterns to reduce unnecessary tool calls, minimize tool-related token overhead, and improve overall agent efficiency.

## Tool Call Token Costs

Every tool call incurs token costs in multiple ways:
1. **Tool definitions**: Included in the system/input tokens on every request.
2. **Tool call generation**: The model generates structured output (function name + arguments) as output tokens.
3. **Tool results**: The tool's response is fed back as input tokens in the next turn.
4. **Multi-turn overhead**: Each tool call creates an additional inference round-trip with cumulative context.

## Optimization Patterns

### 1. Minimize Tool Definitions
- Only register tools the agent actually needs for its current scope.
- Remove tools that are rarely or never called.
- Keep tool descriptions to one line -- the model doesn't need a paragraph to understand a function signature.
- Prefer specific parameter types over free-form strings.

### 2. Reduce Unnecessary Tool Calls
- **Direct knowledge**: If the model can answer from its training data, tool calls waste tokens. Example: looking up "What is Python?" via a search tool.
- **Batching**: If the agent needs data from multiple tools, check if one tool can return combined data instead of making N separate calls.
- **Conditional tools**: Only invoke tools when the model is uncertain. Add instructions like "Use tools only when you cannot answer from your knowledge."

### 3. Tool Result Optimization
- Tool results often contain more data than needed. If possible, configure tools to return concise responses.
- For search tools: return snippets, not full documents.
- For database tools: return only requested columns, not full rows.
- Truncate or summarize large tool responses before feeding them back.

### 4. Iteration Control
- Set `max_infer_iters` to a reasonable limit (3-5 for most tasks).
- Agents with unlimited iterations may loop: call tool A, analyze, call tool B, re-analyze, etc.
- Each iteration compounds the context window (previous messages + tool results accumulate as input tokens).

### 5. MCP Tool Efficiency
- MCP (Model Context Protocol) tools connect the model to external servers.
- Each MCP tool discovery adds to the tool definition token count.
- Only connect to MCP servers whose tools are needed for the current task.
- Consider using toolgroups to scope which tools are available per interaction.

## Agent Architecture Patterns

### Single-Shot vs Multi-Turn
- **Single-shot**: One inference call, no tools. Lowest token cost. Use when the model can answer directly.
- **Single tool call**: One tool invocation, then final response. Moderate cost. Use for lookup-style tasks.
- **Multi-turn agent**: Multiple tool calls with reasoning. Highest cost. Reserve for complex tasks requiring multiple data sources.

### Prompt Design for Tool Efficiency
- "Answer directly if possible. Only use tools if you need real-time data or cannot answer from your knowledge."
- "Use at most 2 tool calls to answer the question."
- "Prefer the [specific_tool] tool over [general_tool] for this type of question."

## Analysis Checklist

When reviewing benchmark results for tool-use optimization:
1. How many tool calls were made per request? Is it proportional to task complexity?
2. Were any tool calls redundant or unnecessary?
3. What percentage of total tokens came from tool definitions vs. actual content?
4. Could `max_infer_iters` be reduced without impacting quality?
5. Are there tools in the definition that were never called? Remove them.
