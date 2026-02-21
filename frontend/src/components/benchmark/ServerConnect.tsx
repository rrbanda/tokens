import { useState } from 'react';
import { Plug, Unplug, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const PROVIDERS = [
  { id: 'llama_stack', label: 'Llama Stack' },
  { id: 'openai', label: 'OpenAI-Compatible' },
] as const;

interface ServerConnectProps {
  connected: boolean;
  loading: boolean;
  error: string | null;
  serverUrl: string;
  status: string;
  onConnect: (url: string, provider: string) => void;
  onDisconnect: () => void;
}

export function ServerConnect({
  connected,
  loading,
  error,
  serverUrl,
  status,
  onConnect,
  onDisconnect,
}: ServerConnectProps) {
  const [url, setUrl] = useState(serverUrl || '');
  const [provider, setProvider] = useState('llama_stack');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onConnect(url.trim().replace(/\/+$/, ''), provider);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-4">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={loading || connected}
          className="px-4 py-2.5 rounded-lg border border-border bg-surface-alt text-text text-sm font-medium
                     focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 min-w-[160px]"
          aria-label="Provider type"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <div className="flex-1 relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={provider === 'openai' ? 'https://api.openai.com' : 'https://llama-stack.apps.example.com'}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface-alt text-text text-sm
                       placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                       disabled:opacity-50 pr-10"
            disabled={loading || connected}
          />
          {connected && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="w-4.5 h-4.5 text-success" />
            </div>
          )}
        </div>

        {connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary
                       hover:bg-surface-hover transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Unplug className="w-4 h-4" />
            Disconnect
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold
                       hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2 whitespace-nowrap shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
            Connect
          </button>
        )}
      </form>

      {connected && (
        <div className="mt-2 flex items-center gap-2 text-xs text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Connected to {serverUrl} — {status}
        </div>
      )}

      {error && !connected && (
        <div className="mt-2 flex items-center gap-2 text-xs text-danger">
          <XCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
