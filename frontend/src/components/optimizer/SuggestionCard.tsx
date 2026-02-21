import { Lightbulb, TrendingDown, Settings, Thermometer, Wrench, MessageSquare } from 'lucide-react';
import type { Suggestion } from '../../api/types';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApplyInstructions?: (revised: string) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Lightbulb; color: string; label: string }> = {
  instructions: { icon: MessageSquare, color: 'text-primary', label: 'Instructions' },
  model: { icon: Settings, color: 'text-info', label: 'Model' },
  temperature: { icon: Thermometer, color: 'text-warning', label: 'Temperature' },
  tools: { icon: Wrench, color: 'text-success', label: 'Tools' },
  prompts: { icon: Lightbulb, color: 'text-output-tokens', label: 'Prompts' },
};

export function SuggestionCard({ suggestion, onApplyInstructions }: SuggestionCardProps) {
  const config = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.instructions;
  const Icon = config.icon;

  return (
    <div className="bg-surface rounded-xl border border-border p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${config.color}`}>
              {config.label}
            </span>
            {suggestion.estimated_token_savings && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium flex items-center gap-0.5">
                <TrendingDown className="w-2.5 h-2.5" />
                {suggestion.estimated_token_savings}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-text mt-1">{suggestion.title}</h4>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{suggestion.description}</p>

          {suggestion.suggested_change && (
            <div className="mt-3 p-3 rounded-lg bg-surface-alt border border-border">
              <div className="text-[10px] text-text-muted uppercase font-semibold mb-1">Suggested Change</div>
              <div className="text-xs text-text font-mono whitespace-pre-wrap">{suggestion.suggested_change}</div>
            </div>
          )}

          {suggestion.revised_instructions && onApplyInstructions && (
            <button
              onClick={() => onApplyInstructions(suggestion.revised_instructions!)}
              className="mt-3 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium
                         hover:bg-primary-hover transition-colors"
            >
              Apply Revised Instructions
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
