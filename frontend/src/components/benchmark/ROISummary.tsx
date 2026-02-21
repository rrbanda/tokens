import { useState } from 'react';
import { TrendingDown, TrendingUp, DollarSign, Zap, Star, ChevronDown, ChevronRight, ArrowRight, X } from 'lucide-react';
import type { BenchmarkResponse } from '../../api/types';
import { formatNumber, formatLatency } from '../../lib/utils';
import { calculateCost, projectMonthlyCost } from '../../lib/pricing';

interface ROISummaryProps {
  before: BenchmarkResponse;
  after: BenchmarkResponse;
  onDismiss: () => void;
}

function pctChange(before: number, after: number): number {
  if (before === 0) return 0;
  return ((after - before) / before) * 100;
}

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v).toLocaleString()}`;
  if (v < 0.01) return `$${v.toFixed(6)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function ROISummary({ before, after, onDismiss }: ROISummaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const requestsPerDay = 1000;

  const beforePrompts = before.results.length || 1;
  const afterPrompts = after.results.length || 1;

  const beforeAvgIn = before.aggregate.input_tokens / beforePrompts;
  const beforeAvgOut = before.aggregate.output_tokens / beforePrompts;
  const afterAvgIn = after.aggregate.input_tokens / afterPrompts;
  const afterAvgOut = after.aggregate.output_tokens / afterPrompts;

  const model = { id: 'gpt-4o', name: 'GPT-4o', input_per_million: 2.50, output_per_million: 10.00 };
  const beforeCostPerReq = calculateCost(beforeAvgIn, beforeAvgOut, model);
  const afterCostPerReq = calculateCost(afterAvgIn, afterAvgOut, model);
  const beforeMonthly = projectMonthlyCost(beforeCostPerReq, requestsPerDay);
  const afterMonthly = projectMonthlyCost(afterCostPerReq, requestsPerDay);
  const monthlySavings = beforeMonthly - afterMonthly;

  const tokenPct = pctChange(before.aggregate.total_tokens, after.aggregate.total_tokens);
  const costPct = pctChange(beforeMonthly, afterMonthly);
  const tokenImproved = tokenPct < 0;
  const costImproved = costPct < 0;

  const hasQuality = before.avg_quality_score != null || after.avg_quality_score != null;
  const qualityMaintained =
    before.avg_quality_score != null && after.avg_quality_score != null
      ? after.avg_quality_score >= before.avg_quality_score - 0.5
      : true;

  return (
    <div className="bg-surface rounded-xl border-2 border-success/40 overflow-hidden">
      {/* Hero banner */}
      <div className="p-5 bg-success/5 border-b border-success/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-success" />
            Optimization Results
          </h3>
          <button onClick={onDismiss} className="p-1 rounded hover:bg-surface-hover transition-colors text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Token Reduction */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-text-muted uppercase">Token Reduction</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text tabular-nums">{formatNumber(before.aggregate.total_tokens)}</span>
              <ArrowRight className="w-4 h-4 text-text-muted" />
              <span className="text-2xl font-bold text-text tabular-nums">{formatNumber(after.aggregate.total_tokens)}</span>
            </div>
            <div className={`text-sm font-bold mt-1 flex items-center gap-1 ${tokenImproved ? 'text-success' : 'text-danger'}`}>
              {tokenImproved ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {tokenPct > 0 ? '+' : ''}{tokenPct.toFixed(1)}%
            </div>
          </div>

          {/* Cost Savings */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-medium text-text-muted uppercase">Monthly Cost ({requestsPerDay.toLocaleString()} req/day)</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-secondary tabular-nums line-through">{formatCurrency(beforeMonthly)}</span>
              <ArrowRight className="w-4 h-4 text-text-muted" />
              <span className="text-2xl font-bold text-success tabular-nums">{formatCurrency(afterMonthly)}</span>
            </div>
            <div className={`text-sm font-bold mt-1 flex items-center gap-1 ${costImproved ? 'text-success' : 'text-danger'}`}>
              {costImproved ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {monthlySavings > 0 ? `Save ${formatCurrency(monthlySavings)}/mo` : `+${formatCurrency(Math.abs(monthlySavings))}/mo`}
            </div>
          </div>

          {/* Quality */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs font-medium text-text-muted uppercase">Quality</span>
            </div>
            {hasQuality ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-text tabular-nums">
                    {before.avg_quality_score != null ? `${before.avg_quality_score.toFixed(1)}` : '—'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-text-muted" />
                  <span className="text-2xl font-bold text-text tabular-nums">
                    {after.avg_quality_score != null ? `${after.avg_quality_score.toFixed(1)}/10` : '—'}
                  </span>
                </div>
                <div className={`text-sm font-bold mt-1 ${qualityMaintained ? 'text-success' : 'text-warning'}`}>
                  {qualityMaintained ? 'Quality maintained' : 'Quality decreased'}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-text-secondary">N/A</div>
                <div className="text-xs text-text-muted mt-1">Enable quality scoring to track</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expandable detail */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full px-5 py-2.5 flex items-center gap-2 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
      >
        {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {showDetails ? 'Hide detailed comparison' : 'Show detailed comparison'}
      </button>

      {showDetails && (
        <div className="border-t border-border">
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
                {[
                  { label: 'Total Tokens', b: before.aggregate.total_tokens, a: after.aggregate.total_tokens, fmt: formatNumber },
                  { label: 'Input Tokens', b: before.aggregate.input_tokens, a: after.aggregate.input_tokens, fmt: formatNumber },
                  { label: 'Output Tokens', b: before.aggregate.output_tokens, a: after.aggregate.output_tokens, fmt: formatNumber },
                  { label: 'Avg Latency', b: before.avg_latency_ms, a: after.avg_latency_ms, fmt: formatLatency },
                  { label: 'Total Latency', b: before.total_latency_ms, a: after.total_latency_ms, fmt: formatLatency },
                ].map((m) => {
                  const pct = pctChange(m.b, m.a);
                  const improved = pct < 0;
                  return (
                    <tr key={m.label} className="border-b border-border/50 last:border-b-0">
                      <td className="px-4 py-2.5 font-medium text-text">{m.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{m.fmt(m.b)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">{m.fmt(m.a)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {m.b > 0 && (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${improved ? 'text-success' : 'text-danger'}`}>
                            {improved ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-prompt */}
          <div className="border-t border-border">
            <div className="px-4 py-2.5 bg-surface-alt text-xs font-semibold text-text-secondary uppercase">Per-Prompt Comparison</div>
            {before.results.map((br, i) => {
              const ar = after.results[i];
              if (!ar) return null;
              const pct = pctChange(br.usage.total_tokens, ar.usage.total_tokens);
              const improved = pct < 0;
              return (
                <div key={i} className="px-4 py-2.5 border-t border-border/30 flex items-center gap-3 text-sm">
                  <span className="w-5 text-text-muted font-mono">{i + 1}</span>
                  <span className="flex-1 text-text truncate font-mono text-xs">{br.prompt}</span>
                  <span className="text-text-secondary font-mono">{br.usage.total_tokens}</span>
                  <ArrowRight className="w-3 h-3 text-text-muted" />
                  <span className="text-text font-mono font-bold">{ar.usage.total_tokens}</span>
                  {br.usage.total_tokens > 0 && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${improved ? 'text-success' : 'text-danger'}`}>
                      {improved ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
