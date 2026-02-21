import { AlertTriangle, BookOpen, ChevronRight } from 'lucide-react';
import type { SkillInfo } from '../../api/types';

interface SkillsListProps {
  skills: SkillInfo[];
  onSelect: (name: string) => void;
  loading: boolean;
  error?: string | null;
}

export function SkillsList({ skills, onSelect, loading, error }: SkillsListProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-alt" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-danger flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Failed to load skills: {error}</span>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No optimization skills found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <button
          key={skill.name}
          onClick={() => onSelect(skill.name)}
          className="w-full text-left p-4 rounded-xl border border-border bg-surface
                     hover:border-primary/30 hover:bg-surface-hover transition-colors flex items-start gap-3"
        >
          <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text">{skill.name}</div>
            <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{skill.description}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
        </button>
      ))}
    </div>
  );
}
