// --- Discovery ---

export interface ModelInfo {
  id: string;
  display_name: string;
  provider: string;
  metadata: Record<string, unknown>;
}

export interface ToolInfo {
  name: string;
  description: string;
  toolgroup: string;
}

export interface DiscoverResponse {
  server_url: string;
  healthy: boolean;
  status: string;
  models: ModelInfo[];
  tools: ToolInfo[];
  error: string | null;
}

// --- Token Usage ---

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: Record<string, unknown> | null;
  output_tokens_details?: Record<string, unknown> | null;
}

// --- Benchmark ---

export interface TestPrompt {
  input: string;
  tags: string[];
  reference_output?: string;
}

export interface BenchmarkRequest {
  server_url: string;
  model_id: string;
  provider: string;
  instructions: string;
  temperature: number | null;
  max_infer_iters: number | null;
  prompts: TestPrompt[];
  score_quality?: boolean;
  judge_model_id?: string;
  num_runs?: number;
}

export interface BenchmarkTestResult {
  prompt: string;
  response_text: string;
  usage: TokenUsage;
  latency_ms: number;
  api_used: string;
  error: string | null;
  quality_score: number | null;
  quality_reasoning: string;
}

export interface BenchmarkResponse {
  id?: string | null;
  server_url: string;
  model_id: string;
  instructions: string;
  temperature: number | null;
  results: BenchmarkTestResult[];
  aggregate: TokenUsage;
  total_latency_ms: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  std_dev_tokens: number;
  avg_quality_score: number | null;
}

export interface ComparisonBenchmarkResponse {
  results: BenchmarkResponse[];
}

// --- Assessment ---

export interface AssessmentResponse {
  verdict: string;
  confidence: string;
  summary: string;
  key_findings: string[];
  estimated_savings_percent: number;
  error: string | null;
}

// --- Optimization ---

export interface Suggestion {
  category: string;
  title: string;
  description: string;
  estimated_token_savings: string;
  suggested_change: string;
  revised_instructions: string | null;
}

export interface OptimizationResponse {
  suggestions: Suggestion[];
  revised_instructions: string;
  summary: string;
  error: string | null;
}

// --- Skills ---

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

export interface SkillDetail {
  name: string;
  description: string;
  content: string;
  path: string;
}

// --- Persisted Runs ---

export interface RunSummary {
  id: string;
  server_url: string;
  model_id: string;
  provider: string;
  instructions: string;
  temperature: number | null;
  aggregate_usage: TokenUsage;
  latency_stats: {
    total_latency_ms: number;
    avg_latency_ms: number;
    min_latency_ms: number;
    max_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
  };
  avg_quality_score: number | null;
  std_dev_tokens: number;
  created_at: string;
}

export interface RunDetail extends RunSummary {
  results: {
    prompt: string;
    response_text: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    latency_ms: number;
    api_used: string;
    quality_score: number | null;
    quality_reasoning: string;
    error: string | null;
  }[];
}

export interface RunsListResponse {
  runs: RunSummary[];
  total: number;
  limit: number;
  offset: number;
}

// --- Agent Traces ---

export interface TraceStepInput {
  step_type: string;
  role?: string;
  content?: string;
  output?: string;
  tool_name?: string;
  tool_calls?: Record<string, unknown>[];
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface TraceUploadRequest {
  name: string;
  description?: string;
  source_format?: string;
  steps: TraceStepInput[];
  metadata?: Record<string, unknown>;
}

export interface TraceSummary {
  id: string;
  name: string;
  description: string;
  source_format: string;
  total_steps: number;
  total_tokens: number;
  total_latency_ms: number;
  created_at: string;
}

export interface TraceStepDetail {
  step_number: number;
  step_type: string;
  role: string;
  content: string;
  output: string;
  tool_name: string;
  tool_calls: Record<string, unknown>[];
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cumulative_tokens: number;
  metadata: Record<string, unknown>;
}

export interface TraceDetail extends TraceSummary {
  metadata: Record<string, unknown>;
  steps: TraceStepDetail[];
}

export interface TraceAnalysis {
  total_steps: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_latency_ms: number;
  tokens_per_step: { step: number; type: string; tokens: number }[];
  context_growth: number[];
  tool_overhead_tokens: number;
  tool_overhead_pct: number;
  inference_tokens: number;
  largest_step: { step: number; tokens: number; type: string };
  avg_tokens_per_inference: number;
  suggestions: string[];
}

export interface TraceUploadResponse {
  id: string;
  analysis: TraceAnalysis;
}

export interface TracesListResponse {
  traces: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface TraceOptimizationResponse {
  suggestions: Suggestion[];
  revised_instructions: string;
  summary: string;
  error: string | null;
}

// --- Pricing ---

export interface PricingModel {
  id: string;
  provider: string;
  model_id: string;
  display_name: string;
  input_per_million: number;
  output_per_million: number;
  is_custom: boolean;
  updated_at: string | null;
}

export interface PricingResponse {
  providers: Record<string, PricingModel[]>;
  total: number;
}

export interface CostCalculationResponse {
  input_cost: number;
  output_cost: number;
  total_cost: number;
  model: PricingModel;
}
