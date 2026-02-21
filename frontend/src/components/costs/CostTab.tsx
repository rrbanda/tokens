import { useState, useMemo, useEffect } from 'react';
import {
  DollarSign, Server, Cloud, ChevronDown, ChevronRight, Calculator,
  AlertCircle, Plus, X, BarChart3, Layers, Zap,
} from 'lucide-react';
import type { BenchmarkResponse } from '../../api/types';
import {
  ON_PREM_OPTIONS,
  annualCloudCost,
  onPremCapex,
  calculateCost,
  type CostInputs,
  type ProviderGroup,
} from '../../lib/pricing';
import { usePricing } from '../../hooks/usePricing';

interface CostTabProps {
  benchmarkResult?: BenchmarkResponse | null;
  traceTokens?: { input: number; output: number } | null;
}

type TokenSource = 'manual' | 'benchmark' | 'trace';

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v).toLocaleString()}`;
  if (v < 0.01) return `$${v.toFixed(6)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function CostTab({ benchmarkResult, traceTokens }: CostTabProps) {
  const { providers, quickModels, loading: pricingLoading, error: pricingError, addCustom, removeCustom } = usePricing();

  const initialTokens = useMemo(() => {
    if (benchmarkResult) {
      const numPrompts = benchmarkResult.results.length || 1;
      return {
        input: Math.round(benchmarkResult.aggregate.input_tokens / numPrompts),
        output: Math.round(benchmarkResult.aggregate.output_tokens / numPrompts),
        source: 'benchmark' as TokenSource,
      };
    }
    if (traceTokens) {
      return { input: traceTokens.input, output: traceTokens.output, source: 'trace' as TokenSource };
    }
    return { input: 500, output: 200, source: 'manual' as TokenSource };
  }, [benchmarkResult, traceTokens]);

  const [inputTokens, setInputTokens] = useState(initialTokens.input);
  const [outputTokens, setOutputTokens] = useState(initialTokens.output);
  const [requestsPerDay, setRequestsPerDay] = useState(1000);
  const [source, setSource] = useState<TokenSource>(initialTokens.source);

  const [showCustom, setShowCustom] = useState(false);
  const [customProvider, setCustomProvider] = useState('custom');
  const [customModelId, setCustomModelId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customInputPrice, setCustomInputPrice] = useState('');
  const [customOutputPrice, setCustomOutputPrice] = useState('');

  const [showEnterprise, setShowEnterprise] = useState(false);
  const [yoyGrowthPct, setYoyGrowthPct] = useState(10);
  const [availabilityHours, setAvailabilityHours] = useState(24);

  useEffect(() => {
    setInputTokens(initialTokens.input);
    setOutputTokens(initialTokens.output);
    setSource(initialTokens.source);
  }, [initialTokens]);

  const inputTokensPerDay = Math.round(inputTokens * requestsPerDay);
  const outputTokensPerDay = Math.round(outputTokens * requestsPerDay);

  const inputs: CostInputs = useMemo(() => ({
    inputTokensPerDay,
    outputTokensPerDay,
    yoyGrowthPct,
    availabilityHoursPerDay: availabilityHours,
  }), [inputTokensPerDay, outputTokensPerDay, yoyGrowthPct, availabilityHours]);

  const handleAddCustom = async () => {
    if (!customModelId || !customInputPrice || !customOutputPrice) return;
    await addCustom({
      provider: customProvider || 'custom',
      model_id: customModelId,
      display_name: customName || customModelId,
      input_per_million: parseFloat(customInputPrice),
      output_per_million: parseFloat(customOutputPrice),
    });
    setCustomModelId('');
    setCustomName('');
    setCustomInputPrice('');
    setCustomOutputPrice('');
    setShowCustom(false);
  };

  const handleManualOverride = (field: 'input' | 'output', value: number) => {
    if (field === 'input') setInputTokens(value);
    else setOutputTokens(value);
    setSource('manual');
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-text">Pricing & Costs</h2>
        <p className="text-sm text-text-muted mt-1">
          Estimate LLM costs, compare providers, and manage custom pricing.
        </p>
      </div>

      {/* Top row: Calculator + Projection side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* Quick Calculator */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text">Calculator</h3>
            </div>
            {source !== 'manual' && (
              <SourceBadge source={source} modelId={benchmarkResult?.model_id} />
            )}
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Input Tokens / Request</label>
                <input
                  type="number"
                  value={inputTokens}
                  onChange={(e) => handleManualOverride('input', Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Output Tokens / Request</label>
                <input
                  type="number"
                  value={outputTokens}
                  onChange={(e) => handleManualOverride('output', Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Requests / Day</label>
                <input
                  type="number"
                  value={requestsPerDay}
                  onChange={(e) => setRequestsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-alt text-text text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="text-xs text-text-muted pt-1 border-t border-border/50">
              {formatTokens(inputTokensPerDay)} in + {formatTokens(outputTokensPerDay)} out = {formatTokens(inputTokensPerDay + outputTokensPerDay)} tokens/day
            </div>
          </div>
        </div>

        {/* Cost Projection */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success" />
              <h3 className="text-sm font-semibold text-text">Cost Projection</h3>
            </div>
            <span className="text-[10px] text-text-muted px-2 py-0.5 bg-surface-alt rounded border border-border/50">
              Estimates only — verify with your provider
            </span>
          </div>

          <div className="p-4">
            {pricingError && (
              <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-700 dark:text-amber-400">Failed to load pricing: {pricingError}</span>
              </div>
            )}

            {pricingLoading ? (
              <div className="text-sm text-text-muted text-center py-8">Loading pricing data...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2.5 font-semibold text-text-secondary text-xs">Model</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-secondary text-xs">Per Request</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-secondary text-xs">Daily</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-secondary text-xs">Monthly</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-secondary text-xs">Yearly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickModels.map((model, i) => {
                      const perReq = calculateCost(inputTokens, outputTokens, model);
                      const daily = perReq * requestsPerDay;
                      const monthly = daily * 30;
                      const yearly = daily * 365;
                      return (
                        <tr
                          key={model.id}
                          className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/30'} hover:bg-primary/5 transition-colors`}
                        >
                          <td className="px-3 py-2.5 font-medium text-text text-sm">
                            {model.name}
                            <span className="text-text-muted text-xs ml-1.5">(${model.input_per_million}/M in)</span>
                          </td>
                          <td className="text-right px-3 py-2.5 font-mono text-text tabular-nums">{formatCurrency(perReq)}</td>
                          <td className="text-right px-3 py-2.5 font-mono text-text tabular-nums">{formatCurrency(daily)}</td>
                          <td className="text-right px-3 py-2.5 font-mono text-text tabular-nums font-semibold">{formatCurrency(monthly)}</td>
                          <td className="text-right px-3 py-2.5 font-mono text-text tabular-nums">{formatCurrency(yearly)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Pricing Models + Enterprise Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pricing Management */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-semibold text-text">Pricing Models</h3>
            </div>
            <button
              onClick={() => setShowCustom(!showCustom)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add custom model
            </button>
          </div>

          {showCustom && (
            <div className="p-4 border-b border-border bg-surface-alt/50">
              <div className="grid grid-cols-5 gap-2">
                <input
                  type="text"
                  value={customProvider}
                  onChange={(e) => setCustomProvider(e.target.value)}
                  placeholder="Provider"
                  className="px-2.5 py-1.5 rounded border border-border bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <input
                  type="text"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  placeholder="Model ID"
                  className="px-2.5 py-1.5 rounded border border-border bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <input
                  type="number"
                  value={customInputPrice}
                  onChange={(e) => setCustomInputPrice(e.target.value)}
                  placeholder="$/M input"
                  step="0.01"
                  className="px-2.5 py-1.5 rounded border border-border bg-surface text-text text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <input
                  type="number"
                  value={customOutputPrice}
                  onChange={(e) => setCustomOutputPrice(e.target.value)}
                  placeholder="$/M output"
                  step="0.01"
                  className="px-2.5 py-1.5 rounded border border-border bg-surface text-text text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleAddCustom}
                    disabled={!customModelId || !customInputPrice || !customOutputPrice}
                    className="px-3 py-1.5 rounded bg-primary text-white text-xs font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button onClick={() => setShowCustom(false)} className="p-1.5 text-text-muted hover:text-text">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-4">
            {pricingLoading ? (
              <div className="text-sm text-text-muted text-center py-6">Loading...</div>
            ) : (
              <div className="space-y-3">
                {providers.map((group) => (
                  <PricingGroup key={group.provider} group={group} onRemove={removeCustom} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Enterprise Projection */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setShowEnterprise(!showEnterprise)}
            className="w-full px-4 py-3 flex items-center gap-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover transition-colors"
          >
            {showEnterprise ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Calculator className="w-4 h-4 text-primary" />
            Provider Comparison (Year 0 / 1 / 2)
          </button>

          {showEnterprise && (
            <div className="px-4 pb-4 space-y-4 border-t border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 mt-4 bg-surface-alt/50 rounded-lg border border-border/50">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Input Tokens / Day</label>
                  <div className="px-3 py-2 rounded-lg border border-border bg-surface text-text text-xs font-mono">
                    {inputTokensPerDay.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Output Tokens / Day</label>
                  <div className="px-3 py-2 rounded-lg border border-border bg-surface text-text text-xs font-mono">
                    {outputTokensPerDay.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">% Increase YoY</label>
                  <input
                    type="number"
                    value={yoyGrowthPct}
                    min={0}
                    max={500}
                    onChange={(e) => setYoyGrowthPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-xs font-mono
                               focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Availability (hrs/day)</label>
                  <input
                    type="number"
                    value={availabilityHours}
                    min={1}
                    max={24}
                    onChange={(e) => setAvailabilityHours(Math.min(24, Math.max(1, parseInt(e.target.value) || 24)))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-xs font-mono
                               focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="text-xs text-text-muted -mt-2">
                {formatTokens(inputTokensPerDay)} input + {formatTokens(outputTokensPerDay)} output tokens/day
                at {requestsPerDay.toLocaleString()} requests/day.
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
                  <Cloud className="w-3.5 h-3.5" /> Cloud Based Solutions
                </h4>
                {providers.map((group) => (
                  <ProviderTable key={group.provider} group={group} inputs={inputs} />
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" /> On-Prem Based Solutions
                </h4>
                <OnPremTable />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source, modelId }: { source: TokenSource; modelId?: string }) {
  const icon = source === 'benchmark'
    ? <BarChart3 className="w-3 h-3" />
    : <Layers className="w-3 h-3" />;
  const label = source === 'benchmark'
    ? `From benchmark${modelId ? `: ${modelId}` : ''}`
    : 'From trace';

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-primary px-2 py-0.5 bg-primary/10 rounded-full">
      {icon}
      {label}
    </span>
  );
}

function PricingGroup({ group, onRemove }: { group: ProviderGroup; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-alt/50 hover:bg-surface-alt/80 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-secondary" /> : <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />}
        <span className="text-[11px] font-semibold text-text">{group.label}</span>
        <span className="text-[10px] text-text-muted ml-auto">{group.models.length} models</span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-3 py-1.5 font-semibold text-text-secondary">Model</th>
                <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">$/M Input</th>
                <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">$/M Output</th>
                <th className="text-right px-3 py-1.5 font-semibold text-text-secondary w-10"></th>
              </tr>
            </thead>
            <tbody>
              {group.models.map((m, i) => (
                <tr
                  key={m.id}
                  className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/30'}`}
                >
                  <td className="px-3 py-1.5 text-text">
                    {m.name}
                    {m.is_custom && <span className="ml-1 text-[9px] text-primary">(custom)</span>}
                  </td>
                  <td className="text-right px-3 py-1.5 font-mono text-text tabular-nums">${m.input_per_million}</td>
                  <td className="text-right px-3 py-1.5 font-mono text-text tabular-nums">${m.output_per_million}</td>
                  <td className="text-right px-3 py-1.5">
                    {m.is_custom && (
                      <button
                        onClick={() => onRemove(m.id)}
                        className="p-0.5 text-text-muted hover:text-danger transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProviderTable({ group, inputs }: { group: ProviderGroup; inputs: CostInputs }) {
  const [expanded, setExpanded] = useState(false);
  const years = [0, 1, 2];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-alt hover:bg-surface-alt/80 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
        <Cloud className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-text uppercase tracking-wide">{group.label}</span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2 font-semibold text-text-secondary w-1/2">Model</th>
                {years.map((y) => (
                  <th key={y} className="text-right px-4 py-2 font-semibold text-text-secondary whitespace-nowrap">
                    Year {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.models.map((model, i) => {
                const costs = years.map((y) => annualCloudCost(model, inputs, y));
                return (
                  <tr
                    key={model.id}
                    className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/30'} hover:bg-primary/5 transition-colors`}
                  >
                    <td className="px-4 py-2 text-text font-medium">
                      {model.name}
                      {model.is_custom && <span className="ml-1 text-[9px] text-primary">(custom)</span>}
                      <span className="text-text-muted ml-1.5">
                        (${model.input_per_million}/M in, ${model.output_per_million}/M out)
                      </span>
                    </td>
                    {costs.map((c, yi) => (
                      <td key={yi} className="text-right px-4 py-2 font-mono text-text tabular-nums">
                        {formatCurrency(c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OnPremTable() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-alt hover:bg-surface-alt/80 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
        <Server className="w-4 h-4 text-warning" />
        <span className="text-xs font-semibold text-text uppercase tracking-wide">On-Prem GPU Estimates (CapEx)</span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2 font-semibold text-text-secondary">Configuration</th>
                <th className="text-right px-4 py-2 font-semibold text-text-secondary">GPU</th>
                <th className="text-right px-4 py-2 font-semibold text-text-secondary"># GPUs</th>
                <th className="text-right px-4 py-2 font-semibold text-text-secondary">Cost / GPU</th>
                <th className="text-right px-4 py-2 font-semibold text-text-secondary">Total CapEx</th>
              </tr>
            </thead>
            <tbody>
              {ON_PREM_OPTIONS.map((opt, i) => (
                <tr
                  key={opt.id}
                  className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/30'} hover:bg-primary/5 transition-colors`}
                >
                  <td className="px-4 py-2 text-text font-medium">{opt.name}</td>
                  <td className="text-right px-4 py-2 text-text-secondary">{opt.gpu}</td>
                  <td className="text-right px-4 py-2 font-mono text-text">{opt.gpus_needed}</td>
                  <td className="text-right px-4 py-2 font-mono text-text">{formatCurrency(opt.cost_per_gpu)}</td>
                  <td className="text-right px-4 py-2 font-mono text-text font-semibold">{formatCurrency(onPremCapex(opt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-text-muted border-t border-border/50">
            CapEx = one-time hardware cost. Does not include hosting, power, cooling, or staffing.
          </div>
        </div>
      )}
    </div>
  );
}
