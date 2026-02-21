export interface ModelPricing {
  id: string;
  name: string;
  input_per_million: number;
  output_per_million: number;
  is_custom?: boolean;
}

export interface ProviderGroup {
  provider: string;
  label: string;
  models: ModelPricing[];
}

export interface OnPremOption {
  id: string;
  name: string;
  gpu: string;
  gpus_needed: number;
  cost_per_gpu: number;
}

export const ON_PREM_OPTIONS: OnPremOption[] = [
  { id: 'a100-llama-70b',    name: 'Llama 70B on A100',       gpu: 'A100 80GB',   gpus_needed: 4, cost_per_gpu: 10_000 },
  { id: 'a100-mixtral-8x7b', name: 'Mixtral 8x7B on A100',    gpu: 'A100 80GB',   gpus_needed: 2, cost_per_gpu: 10_000 },
  { id: 'h100-llama-70b',    name: 'Llama 70B on H100',       gpu: 'H100 80GB',   gpus_needed: 2, cost_per_gpu: 30_000 },
  { id: 'v100-llama-13b',    name: 'Llama 13B on V100',       gpu: 'V100 32GB',   gpus_needed: 3, cost_per_gpu: 10_000 },
  { id: 'v100-mixtral-7b',   name: 'Mixtral 7B on V100',      gpu: 'V100 32GB',   gpus_needed: 2, cost_per_gpu: 10_000 },
  { id: 'v100-mixtral-8x7b', name: 'Mixtral 8x7B on V100',    gpu: 'V100 32GB',   gpus_needed: 8, cost_per_gpu: 10_000 },
];

const PROVIDER_LABELS: Record<string, string> = {
  azure: 'GPT Model Estimates (Azure Cloud)',
  google: 'Google Vertex Estimates',
  anthropic: 'Anthropic Estimates',
  opensource: 'Open-Source (Hosted) Estimates',
};

export function buildProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || `${provider} Estimates`;
}

export interface CostInputs {
  inputTokensPerDay: number;
  outputTokensPerDay: number;
  yoyGrowthPct: number;
  availabilityHoursPerDay: number;
}

export function annualCloudCost(
  model: ModelPricing,
  inputs: CostInputs,
  year: number,
): number {
  const growth = Math.pow(1 + inputs.yoyGrowthPct / 100, year);
  const dailyInputTokens = inputs.inputTokensPerDay * growth;
  const dailyOutputTokens = inputs.outputTokensPerDay * growth;
  const days = 365 * (inputs.availabilityHoursPerDay / 24);
  const inputCost = (dailyInputTokens / 1_000_000) * model.input_per_million * days;
  const outputCost = (dailyOutputTokens / 1_000_000) * model.output_per_million * days;
  return inputCost + outputCost;
}

export function onPremCapex(option: OnPremOption): number {
  return option.gpus_needed * option.cost_per_gpu;
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): number {
  return (inputTokens / 1_000_000) * pricing.input_per_million +
         (outputTokens / 1_000_000) * pricing.output_per_million;
}

export function projectMonthlyCost(
  costPerRequest: number,
  requestsPerDay: number,
): number {
  return costPerRequest * requestsPerDay * 30;
}
