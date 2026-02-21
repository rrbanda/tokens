import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BenchmarkResults } from '../benchmark/BenchmarkResults';
import type { BenchmarkResponse } from '../../api/types';

const mockResult: BenchmarkResponse = {
  server_url: 'https://example.com',
  model_id: 'test-model',
  instructions: 'Be concise',
  temperature: 0.7,
  results: [
    {
      prompt: 'Hello world',
      response_text: 'Hi there!',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: null, output_tokens_details: null },
      latency_ms: 100,
      api_used: 'responses',
      error: null,
    },
  ],
  aggregate: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: null, output_tokens_details: null },
  total_latency_ms: 150,
  avg_latency_ms: 100,
  min_latency_ms: 100,
  max_latency_ms: 100,
  p50_latency_ms: 100,
  p95_latency_ms: 100,
  std_dev_tokens: 0,
};

describe('BenchmarkResults', () => {
  it('renders section title and prompt count', () => {
    render(<BenchmarkResults result={mockResult} />);
    expect(screen.getByText('Detailed Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/1 prompt/)).toBeInTheDocument();
  });

  it('has an export button', () => {
    render(<BenchmarkResults result={mockResult} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows per-prompt row and collapsed latency section', () => {
    render(<BenchmarkResults result={mockResult} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Latency Percentiles & Token Stats')).toBeInTheDocument();
  });
});
