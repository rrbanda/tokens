---
name: token-efficiency
description: Patterns and strategies for reducing overall token consumption in LLM agent interactions without degrading response quality.
---

# Token Efficiency Patterns

You are an expert at analyzing LLM usage patterns and identifying opportunities to reduce token consumption across the full request-response cycle.

## Input Token Optimization

### 1. System Prompt Compression
- System prompts are sent with every request -- even small savings multiply across thousands of calls.
- Target: reduce system prompt tokens by 30-60% while preserving all behavioral constraints.
- Technique: rewrite prose as structured lists, remove filler, eliminate redundancy.

### 2. Context Window Management
- Only include context that is relevant to the current query.
- Avoid sending full conversation history when the last 2-3 turns suffice.
- Use summarization for long conversation threads rather than raw history.

### 3. Few-Shot Example Efficiency
- Each few-shot example costs tokens on every request.
- Use 1-2 examples instead of 5+ when the task is well-defined.
- Consider zero-shot with clear instructions instead of few-shot for simple tasks.

### 4. Tool Description Optimization
- Tool/function definitions are sent as input tokens.
- Keep tool descriptions minimal: name, required params, one-line description.
- Only include tools that are relevant to the current interaction scope.

## Output Token Optimization

### 1. Response Length Control
- Set `max_tokens` or equivalent to cap runaway responses.
- Use explicit length constraints in instructions: "Answer in 1-2 sentences."
- For structured data, specify exact schema rather than letting the model infer format.

### 2. Stop Sequences
- Use stop sequences to prevent the model from generating unnecessary trailing content.
- For code: stop at the end of the function.
- For Q&A: stop after the answer.

### 3. Streaming Token Awareness
- Streaming doesn't reduce tokens but helps detect and abort expensive responses early.
- Monitor streaming output and cancel requests that exceed expected length.

## Temperature and Sampling

### Temperature Impact on Tokens
- **Lower temperature** (0.0-0.3): More deterministic, often shorter responses, fewer tangential expansions.
- **Higher temperature** (0.7-1.0): More creative but may generate longer, more varied outputs.
- For factual Q&A: use temperature 0.0-0.3 to minimize output tokens.
- For creative tasks: temperature 0.7+ is acceptable but expect higher token usage.

### Top-P Sampling
- Lower top_p values (0.8-0.9) can reduce response verbosity.
- Combine with temperature for fine-grained control.

## Model Selection Impact

### Smaller vs Larger Models
- Smaller models often produce shorter responses for the same prompt.
- Test if a smaller model meets quality requirements -- it will use fewer output tokens.
- Use larger models only for complex reasoning tasks where quality is critical.

### Cost-Quality Tradeoff
- Run the same benchmark on multiple models to find the sweet spot.
- A model that uses 30% fewer tokens with 95% quality parity may be the better choice.

## Measurement Framework

When analyzing benchmark results:
1. **Input token ratio**: Are instructions disproportionately large vs. user content?
2. **Output token variance**: High variance suggests inconsistent response length control.
3. **Token-per-quality**: If response quality is similar, prefer the lower-token configuration.
4. **Marginal returns**: Does doubling instruction length actually improve output quality?
