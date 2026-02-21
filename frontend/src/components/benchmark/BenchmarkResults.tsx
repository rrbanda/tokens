import { useState } from 'react';
import { ChevronDown, ChevronRight, List, Clock, Zap, Download } from 'lucide-react';
import type { BenchmarkResponse } from '../../api/types';
import { formatNumber, formatLatency } from '../../lib/utils';

interface BenchmarkResultsProps {
  result: BenchmarkResponse;
}

function handleExport(result: BenchmarkResponse) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `benchmark-${result.model_id}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BenchmarkResults({ result }: BenchmarkResultsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showLatency, setShowLatency] = useState(false);
  const failed = result.results.filter((r) => r.error !== null);

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const maxTokens = Math.max(...result.results.map((r) => r.usage.total_tokens), 1);

  return (
    <div className="bg-surface rounded-xl border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-text-secondary" />
          <h3 className="text-base font-semibold text-text">Detailed Breakdown</h3>
          <span className="text-sm text-text-muted">
            {result.results.length} prompt{result.results.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => handleExport(result)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          aria-label="Download benchmark results as JSON"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      {/* Latency Percentiles — collapsed */}
      <div className="border-b border-border">
        <button
          onClick={() => setShowLatency(!showLatency)}
          className="w-full px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
        >
          {showLatency ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <Clock className="w-3.5 h-3.5" />
          Latency Percentiles & Token Stats
        </button>

        {showLatency && (
          <div className="px-4 pb-3">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-border rounded-lg overflow-hidden">
              <MiniStat label="Min" value={formatLatency(result.min_latency_ms)} />
              <MiniStat label="P50" value={formatLatency(result.p50_latency_ms)} />
              <MiniStat label="Avg" value={formatLatency(result.avg_latency_ms)} />
              <MiniStat label="P95" value={formatLatency(result.p95_latency_ms)} />
              <MiniStat label="Max" value={formatLatency(result.max_latency_ms)} />
              <MiniStat label="Token Std Dev" value={formatNumber(result.std_dev_tokens)} />
            </div>
          </div>
        )}
      </div>

      {failed.length > 0 && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-danger">
          {failed.length} of {result.results.length} prompts failed
        </div>
      )}

      {/* Per-Prompt Results */}
      <div className="divide-y divide-border">
        {result.results.map((r, i) => (
          <div key={i}>
            <button
              className="w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors flex items-center gap-3"
              onClick={() => toggleRow(i)}
              aria-expanded={expandedRows.has(i)}
              aria-label={`Toggle details for prompt ${i + 1}`}
            >
              <span className="text-text-muted">
                {expandedRows.has(i) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
              <span className="flex-1 text-sm text-text truncate font-mono">
                {r.prompt}
              </span>
              {r.error ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-danger font-medium">
                  Error
                </span>
              ) : (
                <div className="flex items-center gap-4 text-xs text-text-secondary shrink-0">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" />
                    {r.usage.total_tokens}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-warning" />
                    {formatLatency(r.latency_ms)}
                  </span>
                  {r.quality_score != null && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      r.quality_score >= 7 ? 'bg-green-100 dark:bg-green-900/40 text-success' :
                      r.quality_score >= 4 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-warning' :
                      'bg-red-100 dark:bg-red-900/40 text-danger'
                    }`}>
                      {r.quality_score}/10
                    </span>
                  )}
                  <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(r.usage.total_tokens / maxTokens) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </button>

            {expandedRows.has(i) && (
              <div className="px-4 pb-4 pl-12 space-y-3">
                {r.error ? (
                  <p className="text-sm text-danger">{r.error}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      <DetailStat label="Input" value={r.usage.input_tokens} />
                      <DetailStat label="Output" value={r.usage.output_tokens} />
                      <DetailStat label="Total" value={r.usage.total_tokens} />
                      <DetailStat label="API" value={r.api_used} />
                    </div>
                    {r.quality_score != null && (
                      <div className={`p-2 rounded-lg border text-xs ${
                        r.quality_score >= 7 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' :
                        r.quality_score >= 4 ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900' :
                        'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                      }`}>
                        <span className="font-semibold">Quality: {r.quality_score}/10</span>
                        {r.quality_reasoning && <span className="ml-2 text-text-secondary">&mdash; {r.quality_reasoning}</span>}
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-surface-alt border border-border text-sm text-text whitespace-pre-wrap max-h-60 overflow-y-auto font-mono text-xs leading-relaxed">
                      {r.response_text || '(empty response)'}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3 text-center">
      <div className="text-xs text-text-muted uppercase mb-0.5">{label}</div>
      <div className="text-sm font-bold text-text tabular-nums">{value}</div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-xs text-text-muted uppercase">{label}</div>
      <div className="text-sm font-semibold text-text">{value}</div>
    </div>
  );
}
