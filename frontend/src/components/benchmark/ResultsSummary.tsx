import { Zap, Clock, Star, DollarSign, Sparkles, Loader2 } from 'lucide-react';
import type { BenchmarkResponse } from '../../api/types';
import { formatNumber, formatLatency } from '../../lib/utils';
import { calculateCost } from '../../lib/pricing';

interface ResultsSummaryProps {
  result: BenchmarkResponse;
  onOptimize: () => void;
  optimizing: boolean;
}

function formatCurrency(v: number): string {
  if (v < 0.01) return `$${v.toFixed(6)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function ResultsSummary({ result, onOptimize, optimizing }: ResultsSummaryProps) {
  const numPrompts = result.results.length || 1;
  const avgInput = result.aggregate.input_tokens / numPrompts;
  const avgOutput = result.aggregate.output_tokens / numPrompts;

  const referenceModel = { id: 'gpt-4o', name: 'GPT-4o', input_per_million: 2.50, output_per_million: 10.00 };
  const estCostPerReq = calculateCost(avgInput, avgOutput, referenceModel);

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">
            Results
          </h3>
          <p className="text-sm text-text-muted mt-0.5">
            {result.model_id} &middot; {numPrompts} prompt{numPrompts !== 1 ? 's' : ''} tested
          </p>
        </div>
        <button
          onClick={onOptimize}
          disabled={optimizing}
          className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold
                     hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2 shadow-sm"
        >
          {optimizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Optimize with AI
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        <HeroMetric
          icon={<Zap className="w-4 h-4 text-primary" />}
          label="Total Tokens"
          value={formatNumber(result.aggregate.total_tokens)}
          detail={`${formatNumber(result.aggregate.input_tokens)} in / ${formatNumber(result.aggregate.output_tokens)} out`}
          color="text-primary"
        />
        <HeroMetric
          icon={<Clock className="w-4 h-4 text-warning" />}
          label="Avg Latency"
          value={formatLatency(result.avg_latency_ms)}
          detail={`${formatLatency(result.min_latency_ms)} min / ${formatLatency(result.max_latency_ms)} max`}
          color="text-warning"
        />
        {result.avg_quality_score != null ? (
          <HeroMetric
            icon={<Star className="w-4 h-4 text-success" />}
            label="Quality Score"
            value={`${result.avg_quality_score.toFixed(1)}/10`}
            detail="LLM-as-judge average"
            color="text-success"
          />
        ) : (
          <HeroMetric
            icon={<Star className="w-4 h-4 text-text-secondary" />}
            label="Std Deviation"
            value={formatNumber(result.std_dev_tokens)}
            detail="Token variance across prompts"
            color="text-text-secondary"
          />
        )}
        <HeroMetric
          icon={<DollarSign className="w-4 h-4 text-success" />}
          label="Est. Cost / Request"
          value={formatCurrency(estCostPerReq)}
          detail={`at ${referenceModel.name} pricing`}
          color="text-success"
        />
      </div>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color} tabular-nums`}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{detail}</div>
    </div>
  );
}
