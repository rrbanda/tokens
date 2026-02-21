import { Sparkles, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import type { TraceOptimizationResponse } from '../../api/types';

interface TraceOptimizationReportProps {
  result: TraceOptimizationResponse;
}

const CATEGORY_LABELS: Record<string, string> = {
  context: 'Context Management',
  tools: 'Tool Efficiency',
  steps: 'Step Reduction',
  output: 'Output Control',
  architecture: 'Architecture',
  instructions: 'Instructions',
  model: 'Model Selection',
  temperature: 'Temperature',
  prompts: 'Prompts',
};

export function TraceOptimizationReport({ result }: TraceOptimizationReportProps) {
  const [copied, setCopied] = useState(false);

  if (result.error) {
    return (
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="text-xs text-danger">{result.error}</div>
      </div>
    );
  }

  const handleCopy = () => {
    if (result.revised_instructions) {
      navigator.clipboard.writeText(result.revised_instructions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4.5 h-4.5 text-primary" />
        <h3 className="text-sm font-semibold text-text">Optimization Suggestions</h3>
      </div>

      {result.summary && (
        <p className="text-xs text-text-secondary leading-relaxed">{result.summary}</p>
      )}

      {result.suggestions.length > 0 && (
        <div className="space-y-2">
          {result.suggestions.map((s, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/50 bg-surface-alt space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-primary/10 text-primary">
                  {CATEGORY_LABELS[s.category] || s.category}
                </span>
                <span className="text-xs font-medium text-text">{s.title}</span>
                {s.estimated_token_savings && (
                  <span className="ml-auto text-[10px] text-green-600 dark:text-green-400 font-medium">
                    {s.estimated_token_savings}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">{s.description}</p>
              {s.suggested_change && (
                <div className="text-[11px] text-text-secondary bg-surface rounded px-2 py-1.5 border border-border/30">
                  {s.suggested_change}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.revised_instructions && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-text-secondary">Revised Instructions</h4>
            <button onClick={handleCopy} className="text-[10px] text-primary hover:underline flex items-center gap-1">
              {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-[11px] text-text bg-surface-alt rounded-lg p-3 border border-border/50 overflow-x-auto whitespace-pre-wrap max-h-48">
            {result.revised_instructions}
          </pre>
        </div>
      )}
    </div>
  );
}
