import { useCallback, useRef, useState } from 'react';
import { runBenchmark, runComparisonBenchmark } from '../api/client';
import type { BenchmarkRequest, BenchmarkResponse } from '../api/types';

export function useBenchmark() {
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [comparisonResults, setComparisonResults] = useState<BenchmarkResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (req: BenchmarkRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    setComparisonResults([]);
    try {
      const res = await runBenchmark(req, controller.signal);
      setResult(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Benchmark failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const compare = useCallback(async (configs: BenchmarkRequest[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    setComparisonResults([]);
    try {
      const res = await runComparisonBenchmark(configs, controller.signal);
      setComparisonResults(res.results);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Comparison failed');
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
    setComparisonResults([]);
    setError(null);
  }, []);

  return { result, comparisonResults, loading, error, run, compare, cancel, clear };
}
