import { useCallback } from 'react';
import { UmamiTracker } from './UmamiTracker';
import { UmamiTrackPayload } from './types';

export function useUmami() {
  const track = useCallback(async (payload: UmamiTrackPayload) => {
    if (!UmamiTracker.isInitialized()) {
      console.warn('[useUmami] Tracker not initialized.');
      return;
    }
    await UmamiTracker.track(payload);
  }, []);

  return { track };
}

/**
 * Convenience hook for automatic effect-based tracking
 */
import { useEffect } from 'react';

export function useUmamiEvent(name: string, payload?: Omit<UmamiTrackPayload, 'name'>) {
  const { track } = useUmami();

  useEffect(() => {
    track({ name, ...payload });
  }, [name, JSON.stringify(payload)]);
}