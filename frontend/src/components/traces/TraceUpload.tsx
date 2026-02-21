import { useState, useRef } from 'react';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import type { TraceUploadRequest } from '../../api/types';

interface TraceUploadProps {
  onUpload: (req: TraceUploadRequest) => Promise<string | null>;
  loading: boolean;
}

export function TraceUpload({ onUpload, loading }: TraceUploadProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'simple' | 'opentelemetry' | 'langsmith'>('simple');
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setJsonText(content);
      setParseError(null);
      if (!name) setName(file.name.replace(/\.json$/, ''));
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setParseError('Invalid JSON. Please paste valid JSON trace data.');
      return;
    }

    let steps: unknown[];
    if (Array.isArray(parsed)) {
      steps = parsed;
    } else if (typeof parsed === 'object' && parsed !== null && 'steps' in parsed) {
      steps = (parsed as { steps: unknown[] }).steps;
      if (!name && 'name' in parsed) setName((parsed as { name: string }).name);
    } else {
      setParseError('JSON must be an array of steps or an object with a "steps" field.');
      return;
    }

    if (!steps.length) {
      setParseError('No steps found in the trace data.');
      return;
    }

    await onUpload({
      name: name || `Trace ${new Date().toLocaleString()}`,
      description,
      source_format: format,
      steps: steps as TraceUploadRequest['steps'],
    });
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text">Upload Agent Trace</h3>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Trace Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Customer support agent run"
            className="w-full px-4 py-3 rounded-lg border border-border bg-surface-alt text-text text-sm
                       placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Source Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="w-full px-4 py-3 rounded-lg border border-border bg-surface-alt text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="simple">Simple (our format)</option>
            <option value="opentelemetry">OpenTelemetry / OpenInference</option>
            <option value="langsmith">LangSmith</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this agent trace represent?"
          className="w-full px-4 py-3 rounded-lg border border-border bg-surface-alt text-text text-sm
                     placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Trace Data (JSON)</label>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm text-primary hover:underline flex items-center gap-1.5 font-medium"
          >
            <FileJson className="w-4 h-4" />
            Load from file
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setParseError(null); }}
          placeholder={`Paste JSON trace data here...\n\nSimple format example:\n[\n  {"step_type": "inference", "role": "user", "content": "Hello", "output": "Hi!", "input_tokens": 10, "output_tokens": 5, "latency_ms": 200},\n  {"step_type": "tool_call", "tool_name": "search", "content": "query", "output": "results", "input_tokens": 50, "output_tokens": 100, "latency_ms": 500}\n]`}
          rows={10}
          className="w-full px-4 py-3 rounded-lg border border-border bg-surface-alt text-text text-sm font-mono
                     placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
        />
      </div>

      {parseError && (
        <div className="flex items-start gap-2.5 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <span className="text-sm text-danger">{parseError}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !jsonText.trim()}
        className="px-8 py-3 rounded-lg bg-primary text-white text-sm font-semibold
                   hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center gap-2.5 shadow-sm"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4.5 h-4.5" />
            Upload & Analyze
          </>
        )}
      </button>
    </div>
  );
}
