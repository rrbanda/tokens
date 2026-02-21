import type {
  AssessmentResponse,
  BenchmarkRequest,
  BenchmarkResponse,
  ComparisonBenchmarkResponse,
  CostCalculationResponse,
  DiscoverResponse,
  OptimizationResponse,
  PricingResponse,
  RunDetail,
  RunsListResponse,
  SkillDetail,
  SkillInfo,
  TraceDetail,
  TraceOptimizationResponse,
  TracesListResponse,
  TraceUploadRequest,
  TraceUploadResponse,
} from './types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// --- Discovery ---

export async function discoverServer(serverUrl: string, provider: string = 'llama_stack'): Promise<DiscoverResponse> {
  return request('/discover', {
    method: 'POST',
    body: JSON.stringify({ server_url: serverUrl, provider }),
  });
}

// --- Benchmark ---

export async function runBenchmark(req: BenchmarkRequest, signal?: AbortSignal): Promise<BenchmarkResponse> {
  return request('/benchmark/run', {
    method: 'POST',
    body: JSON.stringify(req),
    signal,
  });
}

export async function runComparisonBenchmark(
  configs: BenchmarkRequest[],
  signal?: AbortSignal,
): Promise<ComparisonBenchmarkResponse> {
  return request('/benchmark/compare', {
    method: 'POST',
    body: JSON.stringify({ configs }),
    signal,
  });
}

export async function runOptimization(
  serverUrl: string,
  modelId: string,
  instructions: string,
  benchmarkResults: BenchmarkResponse,
  signal?: AbortSignal,
): Promise<OptimizationResponse> {
  return request('/optimize', {
    method: 'POST',
    body: JSON.stringify({
      server_url: serverUrl,
      model_id: modelId,
      instructions,
      benchmark_results: benchmarkResults,
    }),
    signal,
  });
}

export async function runAssessment(
  benchmarkResults: BenchmarkResponse,
  serverUrl?: string,
  modelId?: string,
  signal?: AbortSignal,
): Promise<AssessmentResponse> {
  return request('/assess', {
    method: 'POST',
    body: JSON.stringify({
      benchmark_results: benchmarkResults,
      server_url: serverUrl ?? '',
      model_id: modelId ?? '',
    }),
    signal,
  });
}

// --- Skills ---

export async function fetchSkills(): Promise<SkillInfo[]> {
  return request('/skills');
}

export async function fetchSkill(name: string): Promise<SkillDetail> {
  return request(`/skills/${encodeURIComponent(name)}`);
}

// --- Persisted Runs ---

export async function listRuns(params?: { model_id?: string; limit?: number; offset?: number }): Promise<RunsListResponse> {
  const query = new URLSearchParams();
  if (params?.model_id) query.set('model_id', params.model_id);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request(`/runs${qs ? `?${qs}` : ''}`);
}

export async function getRun(runId: string): Promise<RunDetail> {
  return request(`/runs/${runId}`);
}

export async function deleteRun(runId: string): Promise<void> {
  return request(`/runs/${runId}`, { method: 'DELETE' });
}

export async function exportRun(runId: string): Promise<RunDetail> {
  return request(`/runs/${runId}/export`);
}

// --- Agent Traces ---

export async function uploadTrace(req: TraceUploadRequest): Promise<TraceUploadResponse> {
  return request('/traces', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function listTraces(params?: { limit?: number; offset?: number }): Promise<TracesListResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request(`/traces${qs ? `?${qs}` : ''}`);
}

export async function getTrace(traceId: string): Promise<TraceDetail> {
  return request(`/traces/${traceId}`);
}

export async function deleteTrace(traceId: string): Promise<void> {
  return request(`/traces/${traceId}`, { method: 'DELETE' });
}

export async function optimizeTrace(traceId: string): Promise<TraceOptimizationResponse> {
  return request(`/traces/${traceId}/optimize`, { method: 'POST' });
}

export async function exportTrace(traceId: string): Promise<TraceDetail> {
  return request(`/traces/${traceId}/export`);
}

// --- Pricing ---

export async function fetchPricing(): Promise<PricingResponse> {
  return request('/pricing');
}

export async function addCustomPricing(data: {
  provider: string;
  model_id: string;
  display_name: string;
  input_per_million: number;
  output_per_million: number;
}): Promise<{ id: string }> {
  return request('/pricing/custom', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCustomPricing(pricingId: string): Promise<void> {
  return request(`/pricing/custom/${pricingId}`, { method: 'DELETE' });
}

export async function calculateCost(data: {
  input_tokens: number;
  output_tokens: number;
  model_id: string;
  provider?: string;
}): Promise<CostCalculationResponse> {
  return request('/pricing/calculate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
