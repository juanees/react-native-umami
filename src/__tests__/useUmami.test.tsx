import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useUmami, useUmamiEvent } from '../useUmami';
import { UmamiTracker } from '../UmamiTracker';

function TestComponent() {
  const { track } = useUmami();
  return (
    <button onClick={() => track({ name: 'Click', url: '/btn' })}>Click</button>
  );
}

function EventComponent() {
  useUmamiEvent('Viewed', { url: '/auto' });
  return <div>Page</div>;
}

describe('useUmami hooks', () => {
  beforeEach(() => {
    UmamiTracker.init({ websiteId: 'site-2', hostUrl: 'https://umami.test' });
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(UmamiTracker, 'track').mockResolvedValue();
    vi.clearAllMocks();
  });

  it('useUmami returns track that delegates to UmamiTracker when initialized', async () => {
    render(<TestComponent />);
    const btn = await screen.findByText('Click');
    btn.click();
    expect(UmamiTracker.track).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Click', url: '/btn' })
    );
  });

  it('useUmami warns and does not call track if not initialized', async () => {
    vi.spyOn(UmamiTracker, 'isInitialized').mockReturnValue(false);

    function C() {
      const { track } = useUmami();
      React.useEffect(() => {
        track({ url: '/x' });
      }, []);
      return null;
    }

    render(<C />);
    expect(console.warn).toHaveBeenCalledWith('[useUmami] Tracker not initialized.');
    expect(UmamiTracker.track).not.toHaveBeenCalled();
  });

  it('useUmamiEvent triggers track on mount', async () => {
    vi.clearAllMocks();
    render(<EventComponent />);
    expect(UmamiTracker.track).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Viewed', url: '/auto' })
    );
  });
});
