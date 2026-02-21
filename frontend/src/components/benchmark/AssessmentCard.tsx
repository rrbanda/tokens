import {
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  Loader2,
  Sparkles,
  Eye,
} from 'lucide-react';
import type { AssessmentResponse } from '../../api/types';

interface AssessmentCardProps {
  assessment: AssessmentResponse | null;
  loading: boolean;
  error: string | null;
  onOptimize: () => void;
  optimizing: boolean;
}

const VERDICT_CONFIG = {
  optimize: {
    icon: TrendingDown,
    label: 'Optimization Recommended',
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    badgeBg: 'bg-primary/10',
    badgeText: 'text-primary',
  },
  review: {
    icon: Eye,
    label: 'Worth Reviewing',
    color: 'text-warning',
    bg: 'bg-warning/5',
    border: 'border-warning/20',
    badgeBg: 'bg-warning/10',
    badgeText: 'text-warning',
  },
  efficient: {
    icon: CheckCircle,
    label: 'Already Efficient',
    color: 'text-success',
    bg: 'bg-success/5',
    border: 'border-success/20',
    badgeBg: 'bg-success/10',
    badgeText: 'text-success',
  },
} as const;

export function AssessmentCard({
  assessment,
  loading,
  error,
  onOptimize,
  optimizing,
}: AssessmentCardProps) {
  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        <div>
          <span className="text-sm font-medium text-text">Analyzing results...</span>
          <span className="text-xs text-text-muted ml-2">
            AI advisor is reviewing your benchmark using optimization skills
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-text-muted shrink-0" />
        <span className="text-sm text-text-muted">Assessment unavailable</span>
      </div>
    );
  }

  if (!assessment) return null;

  const verdict = assessment.verdict as keyof typeof VERDICT_CONFIG;
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.review;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-semibold ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-xs text-text-muted px-2 py-0.5 rounded bg-surface border border-border">
                  {assessment.confidence} confidence
                </span>
                {assessment.estimated_savings_percent > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${config.badgeBg} ${config.badgeText}`}>
                    ~{assessment.estimated_savings_percent}% savings potential
                  </span>
                )}
              </div>
              <p className="text-sm text-text leading-snug">
                {assessment.summary}
              </p>
              {assessment.key_findings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {assessment.key_findings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-text-secondary">
                      <span className="text-text-muted mt-0.5 shrink-0">&#8226;</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {verdict !== 'efficient' && (
            <button
              onClick={onOptimize}
              disabled={optimizing}
              className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold
                         hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              {optimizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Optimize Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
