import { BarChart3, Wrench, Zap, AlertTriangle, Sparkles } from 'lucide-react';
import type { TraceAnalysis } from '../../api/types';
import { formatNumber } from '../../lib/utils';

interface TraceAnalysisCardProps {
  analysis: TraceAnalysis;
  onOptimize: () => void;
  optimizing: boolean;
}

export function TraceAnalysisCard({ analysis, onOptimize, optimizing }: TraceAnalysisCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4.5 h-4.5 text-primary" />
          <h3 className="text-sm font-semibold text-text">Trace Analysis</h3>
        </div>
        <button
          onClick={onOptimize}
          disabled={optimizing}
          className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium
                     hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {optimizing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Optimizing...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Optimize with AI
            </>
          )}
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-surface-alt border border-border/50">
          <div className="text-[10px] text-text-muted mb-1">Total Tokens</div>
          <div className="text-lg font-bold text-text">{formatNumber(analysis.total_tokens)}</div>
          <div className="text-[10px] text-text-muted">{formatNumber(analysis.total_input_tokens)}in / {formatNumber(analysis.total_output_tokens)}out</div>
        </div>
        <div className="p-3 rounded-lg bg-surface-alt border border-border/50">
          <div className="text-[10px] text-text-muted mb-1">Steps</div>
          <div className="text-lg font-bold text-text">{analysis.total_steps}</div>
          <div className="text-[10px] text-text-muted">{analysis.total_latency_ms.toFixed(0)}ms total</div>
        </div>
        <div className="p-3 rounded-lg bg-surface-alt border border-border/50">
          <div className="flex items-center gap-1 mb-1">
            <Wrench className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Tool Overhead</span>
          </div>
          <div className={`text-lg font-bold ${analysis.tool_overhead_pct > 40 ? 'text-amber-500' : 'text-text'}`}>
            {analysis.tool_overhead_pct}%
          </div>
          <div className="text-[10px] text-text-muted">{formatNumber(analysis.tool_overhead_tokens)} tokens</div>
        </div>
        <div className="p-3 rounded-lg bg-surface-alt border border-border/50">
          <div className="flex items-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Avg/Inference</span>
          </div>
          <div className="text-lg font-bold text-text">{formatNumber(analysis.avg_tokens_per_inference)}</div>
          <div className="text-[10px] text-text-muted">tokens per call</div>
        </div>
      </div>

      {/* Largest step callout */}
      {analysis.largest_step.tokens > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Largest step: Step {analysis.largest_step.step} ({analysis.largest_step.type}) uses{' '}
            <strong>{formatNumber(analysis.largest_step.tokens)}</strong> tokens
            {analysis.total_tokens > 0 &&
              ` (${Math.round(analysis.largest_step.tokens / analysis.total_tokens * 100)}% of total)`}
          </span>
        </div>
      )}

      {/* Heuristic suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-semibold text-text-secondary">Quick Findings</h4>
          {analysis.suggestions.map((s, i) => (
            <div key={i} className="text-xs text-text-muted pl-3 border-l-2 border-primary/30">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
