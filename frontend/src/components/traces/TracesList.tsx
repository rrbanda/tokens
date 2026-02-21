import { useState } from 'react';
import { Trash2, ChevronRight, Layers } from 'lucide-react';
import type { TraceSummary } from '../../api/types';
import { formatNumber } from '../../lib/utils';

interface TracesListProps {
  traces: TraceSummary[];
  selectedId: string | null;
  onSelect: (traceId: string) => void;
  onDelete: (traceId: string) => void;
}

export function TracesList({ traces, selectedId, onSelect, onDelete }: TracesListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (traces.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border border-dashed flex flex-col items-center justify-center text-center p-10 min-h-[460px]">
        <div className="w-14 h-14 rounded-xl bg-surface-alt flex items-center justify-center mb-4">
          <Layers className="w-7 h-7 text-text-muted" />
        </div>
        <h3 className="text-base font-semibold text-text mb-1">No Traces Yet</h3>
        <p className="text-sm text-text-muted max-w-xs">
          Upload an agent trace using the form to analyze token usage across multi-step workflows.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{traces.length} Traces</h3>
      </div>
      <div className="divide-y divide-border/50">
        {traces.map((t) => (
          <div
            key={t.id}
            className={`px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
              selectedId === t.id ? 'bg-primary/5' : 'hover:bg-surface-hover'
            }`}
            onClick={() => onSelect(t.id)}
          >
            <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
              selectedId === t.id ? 'text-primary rotate-90' : 'text-text-muted'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text truncate">{t.name}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                <span>{t.total_steps} steps</span>
                <span>{formatNumber(t.total_tokens)} tokens</span>
                <span>{t.total_latency_ms.toFixed(0)}ms</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-text-muted">
                {new Date(t.created_at).toLocaleDateString()}
              </span>
              {confirmDelete === t.id ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id); setConfirmDelete(null); }}
                  className="px-3 py-1 rounded-lg text-xs text-danger bg-red-50 dark:bg-red-950/30 font-medium"
                >
                  Confirm
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(t.id); }}
                  className="p-1.5 rounded text-text-muted hover:text-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
