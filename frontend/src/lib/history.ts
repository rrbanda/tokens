import type { RunSummary } from '../api/types';
import { listRuns, deleteRun as apiDeleteRun } from '../api/client';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  serverUrl: string;
  provider: string;
  modelId: string;
  instructions: string;
  promptCount: number;
  totalTokens: number;
  avgLatencyMs: number;
  avgQualityScore: number | null;
}

function runToHistoryEntry(run: RunSummary): HistoryEntry {
  return {
    id: run.id,
    timestamp: run.created_at,
    serverUrl: run.server_url,
    provider: run.provider,
    modelId: run.model_id,
    instructions: run.instructions,
    promptCount: 0,
    totalTokens: run.aggregate_usage?.total_tokens ?? 0,
    avgLatencyMs: run.latency_stats?.avg_latency_ms ?? 0,
    avgQualityScore: run.avg_quality_score ?? null,
  };
}

export async function loadHistoryFromApi(limit = 50, offset = 0): Promise<{ entries: HistoryEntry[]; total: number }> {
  try {
    const resp = await listRuns({ limit, offset });
    return {
      entries: resp.runs.map(runToHistoryEntry),
      total: resp.total,
    };
  } catch {
    return { entries: [], total: 0 };
  }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  try {
    await apiDeleteRun(id);
  } catch {
    // Silently ignore delete failures
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const { entries } = await loadHistoryFromApi(200);
    await Promise.allSettled(entries.map((e) => apiDeleteRun(e.id)));
  } catch {
    // Silently ignore
  }
}
