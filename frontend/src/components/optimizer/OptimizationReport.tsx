import { Sparkles, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { OptimizationResponse } from '../../api/types';
import { SuggestionCard } from './SuggestionCard';
import { PromptDiff } from './PromptDiff';

interface OptimizationReportProps {
  result: OptimizationResponse | null;
  loading: boolean;
  error: string | null;
  onOptimize: () => void;
  onApplyInstructions: (revised: string) => void;
  disabled: boolean;
  originalInstructions?: string;
}

export function OptimizationReport({
  result,
  loading,
  error,
  onOptimize,
  onApplyInstructions,
  disabled,
  originalInstructions = '',
}: OptimizationReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (result?.revised_instructions) {
      try {
        await navigator.clipboard.writeText(result.revised_instructions);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* Clipboard API may fail in non-HTTPS contexts */
      }
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wide flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Prompt Optimization
        </h3>
        <button
          onClick={onOptimize}
          disabled={disabled || loading}
          className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium
                     hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Optimize
            </>
          )}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-danger flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-8 text-text-muted text-sm">
            Run a benchmark first, then click "Optimize" to get AI-powered suggestions for reducing token usage.
          </div>
        )}

        {result && (
          <>
            {result.summary && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-xs text-primary font-semibold uppercase mb-1">Summary</div>
                <p className="text-sm text-text leading-relaxed">{result.summary}</p>
              </div>
            )}

            {result.suggestions.length > 0 && (
              <div className="space-y-3">
                {result.suggestions.map((s, i) => (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    onApplyInstructions={onApplyInstructions}
                  />
                ))}
              </div>
            )}

            {result.revised_instructions && originalInstructions && (
              <PromptDiff original={originalInstructions} revised={result.revised_instructions} />
            )}

            {result.revised_instructions && (
              <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-success font-semibold uppercase">Optimized Instructions</div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-text"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => onApplyInstructions(result.revised_instructions)}
                      className="px-3 py-1 rounded bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors"
                    >
                      Apply & Re-test
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-text font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {result.revised_instructions}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
