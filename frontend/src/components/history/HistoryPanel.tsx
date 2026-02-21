import { useState, useMemo, useEffect, useCallback } from 'react';
import { Clock, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { HistoryEntry } from '../../lib/history';
import { loadHistoryFromApi, deleteHistoryEntry, clearHistory } from '../../lib/history';
import { formatNumber, formatLatency } from '../../lib/utils';

interface HistoryPanelProps {
  onLoadEntry: (entry: HistoryEntry) => void;
}

const PAGE_SIZE = 20;

export function HistoryPanel({ onLoadEntry }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    const { entries: data, total: t } = await loadHistoryFromApi(PAGE_SIZE, pageNum * PAGE_SIZE);
    setEntries(data);
    setTotal(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  const grouped = useMemo(() => {
    const groups: Record<string, HistoryEntry[]> = {};
    for (const e of entries) {
      const date = new Date(e.timestamp).toLocaleDateString();
      (groups[date] ??= []).push(e);
    }
    return groups;
  }, [entries]);

  const handleDelete = async (id: string) => {
    await deleteHistoryEntry(id);
    await fetchPage(page);
  };

  const handleClearAll = async () => {
    await clearHistory();
    setPage(0);
    await fetchPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="w-8 h-8 text-text-muted mb-3 animate-spin" />
        <p className="text-xs text-text-muted">Loading history...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock className="w-12 h-12 text-text-muted mb-4" />
        <h3 className="text-base font-semibold text-text mb-1">No History Yet</h3>
        <p className="text-sm text-text-muted max-w-sm">
          Benchmark results are automatically saved here. Run a benchmark to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">{total} entries</span>
        <button onClick={handleClearAll} className="text-sm text-danger hover:underline">Clear all</button>
      </div>

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">{date}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((e) => (
              <div key={e.id} className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{e.modelId}</div>
                      <div className="text-xs text-text-muted truncate mt-0.5">{e.instructions || '(no instructions)'}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="p-1.5 rounded text-text-muted hover:text-danger transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mt-2.5 text-xs text-text-secondary">
                    <span className="font-mono">{formatNumber(e.totalTokens)} tok</span>
                    <span>{formatLatency(e.avgLatencyMs)}</span>
                    {e.avgQualityScore != null && <span>{e.avgQualityScore}/10</span>}
                    <span className="ml-auto text-text-muted">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                    <button
                      onClick={() => onLoadEntry(e)}
                      className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors"
                    >
                      Load Config
                    </button>
                    <span className="text-xs text-text-muted truncate">{e.serverUrl}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg border border-border text-text-muted disabled:opacity-30 hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg border border-border text-text-muted disabled:opacity-30 hover:bg-surface-hover transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
