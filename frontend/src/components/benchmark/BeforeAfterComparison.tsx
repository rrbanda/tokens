import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { BenchmarkResponse } from '../../api/types';
import { formatNumber, formatLatency } from '../../lib/utils';

interface BeforeAfterComparisonProps {
  before: BenchmarkResponse;
  after: BenchmarkResponse;
  onDismiss: () => void;
}

function Delta({ before, after, unit = '', lower_is_better = true }: { before: number; after: number; unit?: string; lower_is_better?: boolean }) {
  if (before === 0) return null;
  const pct = ((after - before) / before) * 100;
  const improved = lower_is_better ? pct < 0 : pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${improved ? 'text-success' : 'text-danger'}`}>
      {improved ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%{unit}
    </span>
  );
}

export function BeforeAfterComparison({ before, after, onDismiss }: BeforeAfterComparisonProps) {
  const metrics = [
    { label: 'Total Tokens', beforeVal: before.aggregate.total_tokens, afterVal: after.aggregate.total_tokens, format: formatNumber },
    { label: 'Input Tokens', beforeVal: before.aggregate.input_tokens, afterVal: after.aggregate.input_tokens, format: formatNumber },
    { label: 'Output Tokens', beforeVal: before.aggregate.output_tokens, afterVal: after.aggregate.output_tokens, format: formatNumber },
    { label: 'Avg Latency', beforeVal: before.avg_latency_ms, afterVal: after.avg_latency_ms, format: formatLatency },
    { label: 'Total Latency', beforeVal: before.total_latency_ms, afterVal: after.total_latency_ms, format: formatLatency },
  ];

  const hasQuality = before.avg_quality_score != null || after.avg_quality_score != null;

  return (
    <div className="bg-surface rounded-xl border-2 border-primary/30 overflow-hidden">
      <div className="p-4 bg-primary/5 border-b border-primary/20 flex items-center justify-between">
        <h3 className="text-sm font-bold text-text uppercase tracking-wide flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-primary" />
          Before / After Comparison
        </h3>
        <button
          onClick={onDismiss}
          className="text-xs text-text-muted hover:text-text transition-colors"
        >
          Dismiss
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase">Metric</th>
              <th scope="col" className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase">Before</th>
              <th scope="col" className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase">After</th>
              <th scope="col" className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase">Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-b border-border/50 last:border-b-0">
                <td className="px-4 py-2.5 font-medium text-text">{m.label}</td>
                <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{m.format(m.beforeVal)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-text">{m.format(m.afterVal)}</td>
                <td className="px-4 py-2.5 text-right"><Delta before={m.beforeVal} after={m.afterVal} /></td>
              </tr>
            ))}
            {hasQuality && (
              <tr className="border-b border-border/50">
                <td className="px-4 py-2.5 font-medium text-text">Quality Score</td>
                <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{before.avg_quality_score != null ? `${before.avg_quality_score}/10` : '—'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-text">{after.avg_quality_score != null ? `${after.avg_quality_score}/10` : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {before.avg_quality_score != null && after.avg_quality_score != null && (
                    <Delta before={before.avg_quality_score} after={after.avg_quality_score} lower_is_better={false} />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Per-prompt comparison */}
      <div className="border-t border-border">
        <div className="px-4 py-2 bg-surface-alt text-xs font-semibold text-text-secondary uppercase">Per-Prompt Details</div>
        {before.results.map((br, i) => {
          const ar = after.results[i];
          if (!ar) return null;
          return (
            <div key={i} className="px-4 py-2.5 border-t border-border/30 flex items-center gap-3 text-xs">
              <span className="w-5 text-text-muted font-mono">{i + 1}</span>
              <span className="flex-1 text-text truncate font-mono text-[11px]">{br.prompt}</span>
              <span className="text-text-secondary font-mono">{br.usage.total_tokens}</span>
              <ArrowRight className="w-3 h-3 text-text-muted" />
              <span className="text-text font-mono font-bold">{ar.usage.total_tokens}</span>
              <Delta before={br.usage.total_tokens} after={ar.usage.total_tokens} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
