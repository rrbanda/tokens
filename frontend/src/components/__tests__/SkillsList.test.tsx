import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SkillsList } from '../skills/SkillsList';

describe('SkillsList', () => {
  it('shows loading skeletons when loading', () => {
    const { container } = render(
      <SkillsList skills={[]} onSelect={() => {}} loading={true} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error message when error is provided', () => {
    render(
      <SkillsList skills={[]} onSelect={() => {}} loading={false} error="Network error" />,
    );
    expect(screen.getByText(/Failed to load skills/)).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('shows empty state when no skills and no error', () => {
    render(
      <SkillsList skills={[]} onSelect={() => {}} loading={false} />,
    );
    expect(screen.getByText('No optimization skills found.')).toBeInTheDocument();
  });

  it('renders skills list', () => {
    const skills = [
      { name: 'token-efficiency', description: 'Reduce tokens', path: '/skills/token-efficiency' },
    ];
    render(
      <SkillsList skills={skills} onSelect={vi.fn()} loading={false} />,
    );
    expect(screen.getByText('token-efficiency')).toBeInTheDocument();
    expect(screen.getByText('Reduce tokens')).toBeInTheDocument();
  });
});
