import { useCallback, useRef, useState } from 'react';
import { runOptimization } from '../api/client';
import type { BenchmarkResponse, OptimizationResponse } from '../api/types';

export function useOptimizer() {
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const optimize = useCallback(async (
    serverUrl: string,
    modelId: string,
    instructions: string,
    benchmarkResults: BenchmarkResponse,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runOptimization(serverUrl, modelId, instructions, benchmarkResults, controller.signal);
      if (res.error) {
        setError(res.error);
      }
      setResult(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Optimization failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, optimize, cancel, clear };
}
