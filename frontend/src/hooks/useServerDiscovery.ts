import { useCallback, useState } from 'react';
import { discoverServer } from '../api/client';
import type { DiscoverResponse, ModelInfo, ToolInfo } from '../api/types';

export function useServerDiscovery() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [provider, setProvider] = useState('llama_stack');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [status, setStatus] = useState('');

  const discover = useCallback(async (url: string, prov: string = 'llama_stack') => {
    setLoading(true);
    setError(null);
    setConnected(false);
    setModels([]);
    setTools([]);
    setServerUrl(url);
    setProvider(prov);

    try {
      const res: DiscoverResponse = await discoverServer(url, prov);
      if (res.healthy) {
        setConnected(true);
        setModels(res.models);
        setTools(res.tools);
        setStatus(res.status);
      } else {
        setError(res.error || 'Server is not healthy');
        setStatus(res.status);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setModels([]);
    setTools([]);
    setServerUrl('');
    setStatus('');
    setError(null);
  }, []);

  return {
    loading,
    error,
    connected,
    serverUrl,
    provider,
    models,
    tools,
    status,
    discover,
    disconnect,
  };
}
