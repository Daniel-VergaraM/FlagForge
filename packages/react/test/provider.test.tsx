import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { FlagForgeProvider, useFlag } from '../src';

const TestComponent = ({ flagKey }: { flagKey: string }) => {
  const { enabled, loading } = useFlag(flagKey);
  if (loading) return <div data-testid="loading">Loading</div>;
  return <div data-testid="status">{enabled ? 'ON' : 'OFF'}</div>;
};

describe('FlagForgeProvider', () => {
  it('renders children and provides context', async () => {
    render(
      <FlagForgeProvider config={{ sdkKey: 'test-key', evaluatorUrl: 'http://localhost' }}>
        <TestComponent flagKey="flag-1" />
      </FlagForgeProvider>,
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('status')).toBeInTheDocument(), { timeout: 3000 });
  });
});
