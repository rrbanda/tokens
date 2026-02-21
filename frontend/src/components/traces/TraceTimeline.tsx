import { Bot, Wrench, MessageSquare, Eye } from 'lucide-react';
import type { TraceStepDetail } from '../../api/types';
import { formatNumber } from '../../lib/utils';

interface TraceTimelineProps {
  steps: TraceStepDetail[];
  totalTokens: number;
}

const STEP_ICONS: Record<string, typeof Bot> = {
  inference: Bot,
  tool_call: Wrench,
  tool_result: Eye,
  observation: MessageSquare,
};

const STEP_COLORS: Record<string, string> = {
  inference: 'bg-blue-500',
  tool_call: 'bg-amber-500',
  tool_result: 'bg-green-500',
  observation: 'bg-purple-500',
};

export function TraceTimeline({ steps, totalTokens }: TraceTimelineProps) {
  const maxTokens = Math.max(...steps.map((s) => s.total_tokens), 1);

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-text mb-4">Step-by-Step Timeline</h3>

      <div className="space-y-0">
        {steps.map((step, i) => {
          const Icon = STEP_ICONS[step.step_type] || Bot;
          const barColor = STEP_COLORS[step.step_type] || 'bg-gray-500';
          const barWidth = totalTokens > 0 ? (step.total_tokens / maxTokens) * 100 : 0;
          const cumulativePct = totalTokens > 0 ? (step.cumulative_tokens / totalTokens) * 100 : 0;

          return (
            <div key={i} className="flex items-stretch gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center w-6 shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${barColor}/10`}>
                  <Icon className={`w-3 h-3 ${barColor.replace('bg-', 'text-')}`} />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-4 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-text">
                    {step.step_type === 'tool_call' && step.tool_name
                      ? `Tool: ${step.tool_name}`
                      : `${step.step_type}${step.role ? ` (${step.role})` : ''}`}
                  </span>
                  <span className="text-[10px] text-text-muted">Step {step.step_number}</span>
                </div>

                {/* Token bar */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-2 bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-text-secondary shrink-0 w-16 text-right">
                    {formatNumber(step.total_tokens)} tok
                  </span>
                </div>

                {/* Metrics row */}
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>{step.input_tokens}in / {step.output_tokens}out</span>
                  {step.latency_ms > 0 && <span>{step.latency_ms.toFixed(0)}ms</span>}
                  <span className="text-text-secondary">cumulative: {formatNumber(step.cumulative_tokens)} ({cumulativePct.toFixed(0)}%)</span>
                </div>

                {/* Content preview */}
                {step.content && (
                  <div className="mt-1.5 text-[10px] text-text-muted truncate max-w-lg">
                    {step.content.slice(0, 150)}{step.content.length > 150 ? '...' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
