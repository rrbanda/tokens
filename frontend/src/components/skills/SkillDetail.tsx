import { ArrowLeft, BookOpen } from 'lucide-react';
import type { SkillDetail as SkillDetailType } from '../../api/types';

interface SkillDetailProps {
  skill: SkillDetailType;
  onBack: () => void;
}

export function SkillDetailView({ skill, onBack }: SkillDetailProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to skills
      </button>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-text">{skill.name}</h3>
          </div>
          {skill.description && (
            <p className="text-xs text-text-secondary mt-1.5">{skill.description}</p>
          )}
        </div>
        <div className="p-5">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-text whitespace-pre-wrap font-mono">
            {skill.content}
          </div>
        </div>
      </div>
    </div>
  );
}
