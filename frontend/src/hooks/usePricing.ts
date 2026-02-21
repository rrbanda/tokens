import { useCallback, useEffect, useState } from 'react';
import { fetchPricing, addCustomPricing, deleteCustomPricing } from '../api/client';
import type { ProviderGroup, ModelPricing } from '../lib/pricing';
import { buildProviderLabel } from '../lib/pricing';

export function usePricing() {
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchPricing();
      const groups: ProviderGroup[] = Object.entries(resp.providers).map(([provider, models]) => ({
        provider,
        label: buildProviderLabel(provider),
        models: models.map((m) => ({
          id: m.model_id,
          name: m.display_name || m.model_id,
          input_per_million: m.input_per_million,
          output_per_million: m.output_per_million,
          is_custom: m.is_custom,
        })),
      }));
      setProviders(groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCustom = useCallback(async (data: {
    provider: string;
    model_id: string;
    display_name: string;
    input_per_million: number;
    output_per_million: number;
  }) => {
    await addCustomPricing(data);
    await load();
  }, [load]);

  const removeCustom = useCallback(async (pricingId: string) => {
    await deleteCustomPricing(pricingId);
    await load();
  }, [load]);

  const quickModels: ModelPricing[] = providers.length > 0
    ? providers.slice(0, 4).map((g) => g.models[0]).filter(Boolean)
    : [];

  return { providers, quickModels, loading, error, reload: load, addCustom, removeCustom };
}
