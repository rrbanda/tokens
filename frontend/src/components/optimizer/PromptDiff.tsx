import { useMemo } from 'react';
import { wordDiff } from '../../lib/diff';

interface PromptDiffProps {
  original: string;
  revised: string;
}

export function PromptDiff({ original, revised }: PromptDiffProps) {
  const segments = useMemo(() => wordDiff(original, revised), [original, revised]);

  if (!original || !revised) return null;

  const removedWords = segments.filter((s) => s.type === 'removed').reduce((n, s) => n + s.value.split(/\s+/).filter(Boolean).length, 0);
  const addedWords = segments.filter((s) => s.type === 'added').reduce((n, s) => n + s.value.split(/\s+/).filter(Boolean).length, 0);

  return (
    <div className="p-4 rounded-lg bg-surface-alt border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-text-secondary uppercase">Instruction Changes</div>
        <div className="flex gap-3 text-[10px]">
          <span className="text-danger font-medium">-{removedWords} words</span>
          <span className="text-success font-medium">+{addedWords} words</span>
        </div>
      </div>
      <div className="text-sm font-mono leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
        {segments.map((seg, i) => {
          if (seg.type === 'removed') {
            return (
              <span key={i} className="bg-red-100 dark:bg-red-900/40 text-danger line-through decoration-1">
                {seg.value}
              </span>
            );
          }
          if (seg.type === 'added') {
            return (
              <span key={i} className="bg-green-100 dark:bg-green-900/40 text-success">
                {seg.value}
              </span>
            );
          }
          return <span key={i}>{seg.value}</span>;
        })}
      </div>
    </div>
  );
}
