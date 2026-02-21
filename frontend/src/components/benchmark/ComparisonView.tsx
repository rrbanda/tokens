import { BarChart3 } from 'lucide-react';
import type { BenchmarkResponse } from '../../api/types';
import { formatNumber, formatLatency } from '../../lib/utils';

interface ComparisonViewProps {
  results: BenchmarkResponse[];
}

export function ComparisonView({ results }: ComparisonViewProps) {
  if (results.length < 2) return null;

  const maxTotal = Math.max(...results.map((r) => r.aggregate.total_tokens), 1);
  const minTotal = Math.min(...results.map((r) => r.aggregate.total_tokens));

  return (
    <div className="bg-surface rounded-xl border border-border">
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wide flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Side-by-Side Comparison
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="text-left px-5 py-3 text-xs text-text-muted uppercase font-semibold">Metric</th>
              {results.map((r, i) => (
                <th scope="col" key={i} className="text-center px-5 py-3 text-xs text-text-muted uppercase font-semibold">
                  <div>{r.model_id}</div>
                  {r.instructions && (
                    <div className="font-normal text-[10px] mt-0.5 max-w-[200px] truncate">
                      {r.instructions}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <ComparisonRow
              label="Input Tokens"
              values={results.map((r) => r.aggregate.input_tokens)}
              format={formatNumber}
              highlight="lower"
            />
            <ComparisonRow
              label="Output Tokens"
              values={results.map((r) => r.aggregate.output_tokens)}
              format={formatNumber}
              highlight="lower"
            />
            <ComparisonRow
              label="Total Tokens"
              values={results.map((r) => r.aggregate.total_tokens)}
              format={formatNumber}
              highlight="lower"
            />
            <ComparisonRow
              label="Total Latency"
              values={results.map((r) => r.total_latency_ms)}
              format={formatLatency}
              highlight="lower"
            />
            <ComparisonRow
              label="Avg Latency"
              values={results.map((r) => r.avg_latency_ms)}
              format={formatLatency}
              highlight="lower"
            />
            <ComparisonRow
              label="Errors"
              values={results.map((r) => r.results.filter((t) => t.error !== null).length)}
              format={(v) => v.toString()}
              highlight="lower"
            />
          </tbody>
        </table>
      </div>

      {/* Token Distribution Bars */}
      <div className="p-5 border-t border-border space-y-3">
        <div className="text-xs text-text-muted font-semibold uppercase">Token Distribution</div>
        {results.map((r, i) => {
          const pct = (r.aggregate.total_tokens / maxTotal) * 100;
          const isBest = r.aggregate.total_tokens === minTotal;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 text-xs text-text truncate font-mono">{r.model_id}</div>
              <div className="flex-1 h-6 rounded-full bg-border overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${isBest ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-text">
                  {formatNumber(r.aggregate.total_tokens)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  values,
  format,
  highlight,
}: {
  label: string;
  values: number[];
  format: (v: number) => string;
  highlight: 'lower' | 'higher';
}) {
  const best = highlight === 'lower' ? Math.min(...values) : Math.max(...values);

  return (
    <tr>
      <td className="px-5 py-3 text-text-secondary font-medium">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-5 py-3 text-center font-mono ${
            v === best ? 'text-success font-bold' : 'text-text'
          }`}
        >
          {format(v)}
        </td>
      ))}
    </tr>
  );
}
