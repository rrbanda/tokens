from pydantic import BaseModel, Field, field_validator


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    input_tokens_details: dict | None = None
    output_tokens_details: dict | None = None


class InferenceResult(BaseModel):
    model_id: str
    display_name: str = ""
    server_name: str = ""
    response_text: str = ""
    usage: TokenUsage = Field(default_factory=TokenUsage)
    latency_ms: float = 0
    error: str | None = None
    api_used: str = ""


# --- Discovery schemas ---

class ModelInfo(BaseModel):
    id: str
    display_name: str = ""
    provider: str = ""
    metadata: dict = Field(default_factory=dict)


class ToolInfo(BaseModel):
    name: str
    description: str = ""
    toolgroup: str = ""


class DiscoverRequest(BaseModel):
    server_url: str
    provider: str = "llama_stack"


class DiscoverResponse(BaseModel):
    server_url: str
    healthy: bool
    status: str = ""
    models: list[ModelInfo] = Field(default_factory=list)
    tools: list[ToolInfo] = Field(default_factory=list)
    error: str | None = None


# --- Benchmark schemas ---

class TestPrompt(BaseModel):
    input: str
    tags: list[str] = Field(default_factory=list)
    reference_output: str = ""


MAX_PROMPTS = 20


class BenchmarkRequest(BaseModel):
    server_url: str
    model_id: str
    provider: str = "llama_stack"
    instructions: str = ""
    temperature: float | None = None
    max_infer_iters: int | None = None
    prompts: list[TestPrompt]
    score_quality: bool = False
    judge_model_id: str = ""
    num_runs: int = 1

    @field_validator("prompts")
    @classmethod
    def limit_prompts(cls, v: list[TestPrompt]) -> list[TestPrompt]:
        if len(v) > MAX_PROMPTS:
            raise ValueError(f"Maximum {MAX_PROMPTS} prompts allowed per request")
        return v

    @field_validator("num_runs")
    @classmethod
    def limit_runs(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("num_runs must be between 1 and 10")
        return v


class BenchmarkTestResult(BaseModel):
    prompt: str
    response_text: str = ""
    usage: TokenUsage = Field(default_factory=TokenUsage)
    latency_ms: float = 0
    api_used: str = ""
    error: str | None = None
    quality_score: float | None = None
    quality_reasoning: str = ""


class BenchmarkResponse(BaseModel):
    id: str | None = None
    server_url: str
    model_id: str
    instructions: str = ""
    temperature: float | None = None
    results: list[BenchmarkTestResult] = Field(default_factory=list)
    aggregate: TokenUsage = Field(default_factory=TokenUsage)
    total_latency_ms: float = 0
    avg_latency_ms: float = 0
    min_latency_ms: float = 0
    max_latency_ms: float = 0
    p50_latency_ms: float = 0
    p95_latency_ms: float = 0
    std_dev_tokens: float = 0
    avg_quality_score: float | None = None


class ComparisonBenchmarkRequest(BaseModel):
    configs: list[BenchmarkRequest]


class ComparisonBenchmarkResponse(BaseModel):
    results: list[BenchmarkResponse]


# --- Assessment schemas ---

class AssessmentRequest(BaseModel):
    benchmark_results: BenchmarkResponse
    server_url: str = ""
    model_id: str = ""


class AssessmentResponse(BaseModel):
    verdict: str = ""
    confidence: str = ""
    summary: str = ""
    key_findings: list[str] = Field(default_factory=list)
    estimated_savings_percent: int = 0
    error: str | None = None


# --- Optimization schemas ---

class OptimizationRequest(BaseModel):
    server_url: str
    model_id: str
    instructions: str
    benchmark_results: BenchmarkResponse


class Suggestion(BaseModel):
    category: str
    title: str
    description: str
    estimated_token_savings: str = ""
    suggested_change: str = ""
    revised_instructions: str | None = None


class OptimizationResponse(BaseModel):
    suggestions: list[Suggestion] = Field(default_factory=list)
    revised_instructions: str = ""
    summary: str = ""
    error: str | None = None


# --- Agent Trace schemas ---


class TraceStepSchema(BaseModel):
    step_type: str = "inference"
    role: str = ""
    content: str = ""
    output: str = ""
    tool_name: str = ""
    tool_calls: list[dict] = Field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0
    metadata: dict = Field(default_factory=dict)


class TraceUploadRequest(BaseModel):
    name: str
    description: str = ""
    source_format: str = "simple"
    steps: list[TraceStepSchema]
    metadata: dict = Field(default_factory=dict)

    @field_validator("steps")
    @classmethod
    def limit_steps(cls, v: list[TraceStepSchema]) -> list[TraceStepSchema]:
        if len(v) > 500:
            raise ValueError("Maximum 500 steps per trace")
        return v


# --- Skills schemas ---

class SkillInfo(BaseModel):
    name: str
    description: str = ""
    path: str = ""


class SkillDetail(BaseModel):
    name: str
    description: str = ""
    content: str = ""
    path: str = ""
