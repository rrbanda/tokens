import { Plus, Trash2 } from 'lucide-react';
import type { ModelInfo } from '../../api/types';

interface TestConfigProps {
  models: ModelInfo[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
  instructions: string;
  onSetInstructions: (v: string) => void;
  temperature: number;
  onSetTemperature: (v: number) => void;
  prompts: string[];
  onSetPrompts: (v: string[]) => void;
  disabled: boolean;
  scoreQuality: boolean;
  onSetScoreQuality: (v: boolean) => void;
  judgeModel: string;
  onSetJudgeModel: (v: string) => void;
  numRuns: number;
  onSetNumRuns: (v: number) => void;
  compact?: boolean;
}

export function TestConfig({
  models,
  selectedModel,
  onSelectModel,
  instructions,
  onSetInstructions,
  temperature,
  onSetTemperature,
  prompts,
  onSetPrompts,
  disabled,
  scoreQuality,
  onSetScoreQuality,
  judgeModel,
  onSetJudgeModel,
  numRuns,
  onSetNumRuns,
  compact,
}: TestConfigProps) {
  const addPrompt = () => onSetPrompts([...prompts, '']);
  const removePrompt = (i: number) => onSetPrompts(prompts.filter((_, idx) => idx !== i));
  const updatePrompt = (i: number, v: string) => {
    const next = [...prompts];
    next[i] = v;
    onSetPrompts(next);
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      {/* Model selector */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value)}
          disabled={disabled || models.length === 0}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     disabled:opacity-50"
        >
          <option value="">Select a model...</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name || m.id}
              {m.provider ? ` (${m.provider})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
          Temperature: {temperature.toFixed(2)}
        </label>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={temperature}
          onChange={(e) => onSetTemperature(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-text-muted -mt-0.5">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Options row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={scoreQuality}
            onChange={(e) => onSetScoreQuality(e.target.checked)}
            disabled={disabled}
            className="accent-primary w-3.5 h-3.5"
          />
          <span className="font-medium">Quality scoring</span>
        </label>

        {scoreQuality && (
          <select
            value={judgeModel}
            onChange={(e) => onSetJudgeModel(e.target.value)}
            disabled={disabled || models.length === 0}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-alt text-text text-xs
                       focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 max-w-[200px]"
          >
            <option value="">Auto judge</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.id}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <span className="font-medium text-text-secondary">Runs:</span>
          <select
            value={numRuns}
            onChange={(e) => onSetNumRuns(parseInt(e.target.value))}
            disabled={disabled}
            className="px-2 py-1 rounded-lg border border-border bg-surface-alt text-text text-xs
                       focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            {[1, 2, 3, 5].map((n) => (
              <option key={n} value={n}>{n}{n > 1 ? ' (avg)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* System prompt */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
          System Prompt
        </label>
        <textarea
          value={instructions}
          onChange={(e) => onSetInstructions(e.target.value)}
          disabled={disabled}
          rows={compact ? 2 : 3}
          placeholder="You are a helpful assistant..."
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-alt text-text text-sm
                     placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     disabled:opacity-50 resize-y font-mono leading-relaxed"
        />
      </div>

      {/* Test prompts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Test Prompts
          </label>
          <button
            type="button"
            onClick={addPrompt}
            disabled={disabled}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="space-y-2">
          {prompts.map((p, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex items-center justify-center w-6 text-xs text-text-muted font-mono shrink-0">
                {i + 1}
              </div>
              <input
                type="text"
                value={p}
                onChange={(e) => updatePrompt(i, e.target.value)}
                disabled={disabled}
                placeholder={`Test prompt ${i + 1}...`}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm
                           placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                           disabled:opacity-50"
              />
              {prompts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePrompt(i)}
                  disabled={disabled}
                  className="p-1.5 text-text-muted hover:text-danger transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
