import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UmamiTracker } from '../UmamiTracker';

// Use the global fetch mock provided by jsdom or create one
const originalFetch = globalThis.fetch;

function mockFetchResolve() {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
}

function restoreFetch() {
  globalThis.fetch = originalFetch as any;
}

describe('UmamiTracker', () => {
  beforeEach(() => {
    // Reset module internal state by re-initializing
    UmamiTracker.init({ websiteId: 'site-123', hostUrl: 'https://umami.local/' });
    mockFetchResolve();
  });

  it('isInitialized reflects init state', () => {
    expect(UmamiTracker.isInitialized()).toBe(true);
  });

  it('track sends POST to /api/send with normalized hostUrl', async () => {
    await UmamiTracker.track({ url: '/foo' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('https://umami.local/api/send');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.type).toBe('pageview');
    expect(body.payload.website).toBe('site-123');
    expect(body.payload.url).toBe('/foo');
  });

  it('track infers event type when name provided', async () => {
    await UmamiTracker.track({ name: 'Click', url: '/bar' });

    const [, options] = (globalThis.fetch as any).mock.calls.at(-1);
    const body = JSON.parse(options.body);
    expect(body.type).toBe('event');
    expect(body.payload.name).toBe('Click');
  });

  it('track uses defaults for language/hostname/screen when not provided', async () => {
    await UmamiTracker.track({});

    const [, options] = (globalThis.fetch as any).mock.calls.at(-1);
    const body = JSON.parse(options.body);

    expect(body.payload.language).toBeTruthy();
    expect(body.payload.hostname).toBeTruthy();
    expect(body.payload.screen).toMatch(/\d+x\d+/);
  });

  it('throws if not initialized', async () => {
    restoreFetch();
    vi.resetModules();
    const { UmamiTracker: FreshTracker } = await import('../UmamiTracker');
    // @ts-expect-error intentional misuse to trigger error
    await expect(FreshTracker.track({})).rejects.toThrow('[UmamiTracker] Not initialized');
  });
});
