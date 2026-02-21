import { useCallback, useState } from 'react';
import {
  uploadTrace,
  listTraces,
  getTrace,
  deleteTrace as apiDeleteTrace,
  optimizeTrace as apiOptimizeTrace,
} from '../api/client';
import type {
  TraceAnalysis,
  TraceDetail,
  TraceSummary,
  TraceOptimizationResponse,
  TraceUploadRequest,
} from '../api/types';

export function useTraces() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [analysis, setAnalysis] = useState<TraceAnalysis | null>(null);
  const [optimization, setOptimization] = useState<TraceOptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTraces = useCallback(async (limit = 50, offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listTraces({ limit, offset });
      setTraces(resp.traces);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load traces');
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(async (req: TraceUploadRequest) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setOptimization(null);
    try {
      const resp = await uploadTrace(req);
      setAnalysis(resp.analysis);
      const detail = await getTrace(resp.id);
      setSelectedTrace(detail);
      await fetchTraces();
      return resp.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTraces]);

  const selectTrace = useCallback(async (traceId: string) => {
    setLoading(true);
    setError(null);
    setOptimization(null);
    try {
      const detail = await getTrace(traceId);
      setSelectedTrace(detail);
      // Re-derive analysis from the stored steps
      const stepsData = detail.steps.map((s) => ({
        step_type: s.step_type,
        input_tokens: s.input_tokens,
        output_tokens: s.output_tokens,
        total_tokens: s.total_tokens,
        latency_ms: s.latency_ms,
        tool_name: s.tool_name,
        content: s.content,
        output: s.output,
      }));
      // Calculate analysis client-side for immediate display
      let cumulative = 0;
      let toolTokens = 0;
      let inferenceTokens = 0;
      let inferenceCount = 0;
      let largest = { step: 0, tokens: 0, type: '' };
      const contextGrowth: number[] = [];
      const tokensPerStep: { step: number; type: string; tokens: number }[] = [];

      for (let i = 0; i < stepsData.length; i++) {
        const s = stepsData[i];
        const t = s.total_tokens || (s.input_tokens + s.output_tokens);
        cumulative += t;
        contextGrowth.push(cumulative);
        tokensPerStep.push({ step: i, type: s.step_type, tokens: t });
        if (t > largest.tokens) largest = { step: i, tokens: t, type: s.step_type };
        if (s.step_type === 'tool_call') toolTokens += t;
        else { inferenceTokens += t; inferenceCount++; }
      }

      setAnalysis({
        total_steps: stepsData.length,
        total_tokens: cumulative,
        total_input_tokens: stepsData.reduce((a, s) => a + s.input_tokens, 0),
        total_output_tokens: stepsData.reduce((a, s) => a + s.output_tokens, 0),
        total_latency_ms: stepsData.reduce((a, s) => a + s.latency_ms, 0),
        tokens_per_step: tokensPerStep,
        context_growth: contextGrowth,
        tool_overhead_tokens: toolTokens,
        tool_overhead_pct: cumulative > 0 ? Math.round(toolTokens / cumulative * 1000) / 10 : 0,
        inference_tokens: inferenceTokens,
        largest_step: largest,
        avg_tokens_per_inference: inferenceCount > 0 ? Math.round(inferenceTokens / inferenceCount) : 0,
        suggestions: [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trace');
    } finally {
      setLoading(false);
    }
  }, []);

  const optimize = useCallback(async (traceId: string) => {
    setOptimizing(true);
    setError(null);
    try {
      const result = await apiOptimizeTrace(traceId);
      setOptimization(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  }, []);

  const removeTrace = useCallback(async (traceId: string) => {
    try {
      await apiDeleteTrace(traceId);
      if (selectedTrace?.id === traceId) {
        setSelectedTrace(null);
        setAnalysis(null);
        setOptimization(null);
      }
      await fetchTraces();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }, [selectedTrace, fetchTraces]);

  const clearSelection = useCallback(() => {
    setSelectedTrace(null);
    setAnalysis(null);
    setOptimization(null);
    setError(null);
  }, []);

  return {
    traces,
    total,
    selectedTrace,
    analysis,
    optimization,
    loading,
    optimizing,
    error,
    fetchTraces,
    upload,
    selectTrace,
    optimize,
    removeTrace,
    clearSelection,
  };
}
