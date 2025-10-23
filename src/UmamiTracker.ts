import {
  UmamiInitOptions,
  UmamiTrackPayload,
  IdentifyPayload,
  DeviceInfo,
  KeyValueStorage,
  RetryOptions,
  BatchingOptions,
  NetworkOptions,
} from './types';
import { Platform } from 'react-native';

let _websiteId: string | null = null;
let _hostUrl: string | null = null;

// Configuration and state
let _sendPath = '/api/send';
let _batchPath = '/api/send/batch';
let _retryOptions: Required<RetryOptions> = {
  retries: 5,
  minDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: true,
};
let _batching: Required<BatchingOptions> = {
  enabled: false,
  maxBatchSize: 20,
  maxIntervalMs: 10000,
};
let _storage: KeyValueStorage | null = null;
let _network: NetworkOptions | null = null;
let _deviceInfoProvider: UmamiInitOptions['deviceInfoProvider'] | undefined;
let _appVersion: string | undefined;

// Identity & session
let _anonymousId: string | null = null;
let _userId: string | null = null;
let _userProperties: Record<string, unknown> | null = null;
let _customDimensions: Record<string, unknown> | null = null;
let _sessionId: string | null = null;

// Queue & timers
type Queued = { body: any; attempt: number; nextAttemptAt: number };
const _queue: Queued[] = [];
let _flushTimer: any = null;
let _deviceInfoCache: DeviceInfo | null = null;

const DEFAULT_MEMORY_STORAGE: KeyValueStorage = {
  async getItem(key: string) {
    return MEMORY_STORE.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    MEMORY_STORE.set(key, value);
  },
  async removeItem(key: string) {
    MEMORY_STORE.delete(key);
  },
};
const MEMORY_STORE = new Map<string, string>();

function nowMs() {
  return Date.now();
}

function randomId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const ts = nowMs().toString(36);
  return `${prefix}_${ts}_${rnd}`;
}

function computeBackoffDelay(attempt: number): number {
  const base = Math.min(
    _retryOptions.minDelayMs * Math.pow(_retryOptions.factor, attempt),
    _retryOptions.maxDelayMs
  );
  if (_retryOptions.jitter) {
    const jitter = Math.random() * base * 0.5; // up to 50% jitter
    return base / 2 + jitter;
  }
  return base;
}

async function isOnline(): Promise<boolean> {
  const provider = _network?.isOnline;
  try {
    const result = typeof provider === 'function' ? await provider() : undefined;
    if (typeof result === 'boolean') return result;
  } catch {}
  // Fallback: assume online
  return true;
}

function scheduleFlush(afterMs?: number) {
  if (_flushTimer) return;
  const delay = afterMs ?? (_batching.enabled ? _batching.maxIntervalMs : 0);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flushQueue();
  }, delay);
}

async function maybeGetDeviceInfo(): Promise<DeviceInfo | null> {
  if (_deviceInfoCache) return _deviceInfoCache;
  try {
    if (_deviceInfoProvider) {
      const info = await Promise.resolve(_deviceInfoProvider());
      _deviceInfoCache = {
        os: Platform?.OS ?? info.os,
        ...info,
        appVersion: info.appVersion ?? _appVersion,
      };
      return _deviceInfoCache;
    }
  } catch {}
  // Default minimal info
  const info: DeviceInfo = {
    os: Platform?.OS ?? 'web',
    osVersion: undefined,
    model: undefined,
    appVersion: _appVersion,
  };
  _deviceInfoCache = info;
  return info;
}

async function getStorage(): Promise<KeyValueStorage> {
  return _storage ?? DEFAULT_MEMORY_STORAGE;
}

async function getAnonymousId(): Promise<string> {
  if (_anonymousId) return _anonymousId;
  const storage = await getStorage();
  const key = 'umami:anonymousId';
  const existing = await storage.getItem(key);
  if (existing) {
    _anonymousId = existing;
    return existing;
  }
  const fresh = randomId('anon');
  _anonymousId = fresh;
  await storage.setItem(key, fresh);
  return fresh;
}

async function getSessionId(): Promise<string> {
  if (_sessionId) return _sessionId;
  const storage = await getStorage();
  const key = 'umami:sessionId';
  const existing = await storage.getItem(key);
  if (existing) {
    _sessionId = existing;
    return existing;
  }
  const fresh = randomId('sess');
  _sessionId = fresh;
  await storage.setItem(key, fresh);
  return fresh;
}

async function buildBody(payload: UmamiTrackPayload) {
  const language =
    payload.language ??
    Intl?.DateTimeFormat()?.resolvedOptions()?.locale ??
    'en';

  const hostname =
    payload.hostname ??
    (typeof window !== 'undefined'
      ? window.location.hostname
      : `${Platform.OS}-app`);

  const screenDims =
    payload.screen ??
    (typeof window !== 'undefined'
      ? `${window.innerWidth}x${window.innerHeight}`
      : '0x0');

  const deviceInfo = await maybeGetDeviceInfo();
  const anonymousId = await getAnonymousId();
  const sessionId = await getSessionId();

  const mergedData = {
    ...payload.data,
    device: deviceInfo ?? undefined,
    userId: _userId ?? payload.userId ?? undefined,
    anonymousId: anonymousId ?? payload.anonymousId ?? undefined,
    userProperties: _userProperties ?? payload.userProperties ?? undefined,
    customDimensions: _customDimensions ?? payload.customDimensions ?? undefined,
    sessionId: _sessionId ?? payload.sessionId ?? sessionId,
  };

  return {
    type: payload.name ? 'event' : 'pageview',
    payload: {
      website: _websiteId,
      hostname,
      language,
      referrer: payload.referrer ?? '',
      screen: screenDims,
      title: payload.title ?? '',
      url: payload.url ?? 'app://screen',
      name: payload.name,
      data: mergedData,
    },
  };
}

async function sendSingle(body: any): Promise<void> {
  await fetch(`${_hostUrl}${_sendPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendBatch(bodies: any[]): Promise<void> {
  await fetch(`${_hostUrl}${_batchPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: bodies }),
  });
}

async function flushQueue() {
  if (_queue.length === 0) return;
  if (!(await isOnline())) {
    // Try again later
    scheduleFlush(2000);
    return;
  }

  try {
    if (_batching.enabled) {
      const toSend = _queue
        .filter((q) => q.nextAttemptAt <= nowMs())
        .splice(0, _batching.maxBatchSize);
      if (toSend.length === 0) return;
      const bodies = toSend.map((q) => q.body);
      await sendBatch(bodies);
      // Remove the sent items from the original queue
      for (const item of toSend) {
        const idx = _queue.indexOf(item);
        if (idx >= 0) _queue.splice(idx, 1);
      }
    } else {
      // Send one by one to preserve order
      const next = _queue.find((q) => q.nextAttemptAt <= nowMs());
      if (!next) return;
      await sendSingle(next.body);
      const idx = _queue.indexOf(next);
      if (idx >= 0) _queue.splice(idx, 1);
    }
  } catch (err) {
    // Apply backoff and requeue
    const items = _batching.enabled
      ? _queue.filter((q) => q.nextAttemptAt <= nowMs()).slice(0, _batching.maxBatchSize)
      : _queue.filter((q) => q.nextAttemptAt <= nowMs()).slice(0, 1);
    for (const it of items) {
      it.attempt += 1;
      if (it.attempt > _retryOptions.retries) {
        // Drop after max retries
        const idx = _queue.indexOf(it);
        if (idx >= 0) _queue.splice(idx, 1);
        continue;
      }
      it.nextAttemptAt = nowMs() + computeBackoffDelay(it.attempt);
    }
  } finally {
    // Schedule next attempt if there are still items
    if (_queue.length > 0) {
      const nextDue = Math.max(0, Math.min(..._queue.map((q) => q.nextAttemptAt)) - nowMs());
      scheduleFlush(nextDue);
    }
  }
}

export const UmamiTracker = {
  /**
   * Initialize Umami client.
   */
  init({
    websiteId,
    hostUrl,
    appVersion,
    deviceInfoProvider,
    storage,
    network,
    batching,
    retry,
    sendPath,
    batchPath,
  }: UmamiInitOptions) {
    _websiteId = websiteId;
    _hostUrl = hostUrl.replace(/\/$/, '');
    _appVersion = appVersion;
    _deviceInfoProvider = deviceInfoProvider;
    _storage = storage ?? DEFAULT_MEMORY_STORAGE;
    _network = network ?? null;
    _batching = {
      enabled: batching?.enabled ?? false,
      maxBatchSize: batching?.maxBatchSize ?? 20,
      maxIntervalMs: batching?.maxIntervalMs ?? 10000,
    };
    _retryOptions = {
      retries: retry?.retries ?? 5,
      minDelayMs: retry?.minDelayMs ?? 1000,
      maxDelayMs: retry?.maxDelayMs ?? 30000,
      factor: retry?.factor ?? 2,
      jitter: retry?.jitter ?? true,
    };
    _sendPath = sendPath ?? '/api/send';
    _batchPath = batchPath ?? '/api/send/batch';

    // Proactively establish ids (non-blocking)
    void getAnonymousId();
    void getSessionId();
  },

  /**
   * Check initialization state.
   */
  isInitialized(): boolean {
    return Boolean(_websiteId && _hostUrl);
  },

  /**
   * Track a pageview or event.
   */
  async track(payload: UmamiTrackPayload): Promise<void> {
    if (!_websiteId || !_hostUrl) {
      throw new Error(
        '[UmamiTracker] Not initialized. Call init({ websiteId, hostUrl }) first.'
      );
    }
    const body = await buildBody(payload);

    // If batching is enabled or offline, queue it; otherwise try immediate send
    if (_batching.enabled || !(await isOnline())) {
      _queue.push({ body, attempt: 0, nextAttemptAt: nowMs() });
      scheduleFlush();
      return;
    }

    try {
      await sendSingle(body);
    } catch (err) {
      console.warn('[UmamiTracker] Failed to send event:', err);
      _queue.push({ body, attempt: 1, nextAttemptAt: nowMs() + computeBackoffDelay(1) });
      scheduleFlush();
    }
  },

  /**
   * Identify a user with optional properties.
   */
  async identify(payload: IdentifyPayload): Promise<void> {
    _userId = payload.userId;
    _userProperties = payload.userProperties ?? _userProperties;
    const storage = await getStorage();
    await storage.setItem('umami:userId', _userId);
    if (_userProperties) {
      await storage.setItem('umami:userProps', JSON.stringify(_userProperties));
    }
  },

  /**
   * Set or merge user properties.
   */
  async setUserProperties(properties: Record<string, unknown>): Promise<void> {
    _userProperties = { ...(_userProperties ?? {}), ...properties };
    const storage = await getStorage();
    await storage.setItem('umami:userProps', JSON.stringify(_userProperties));
  },

  /**
   * Set or merge custom dimensions for subsequent events.
   */
  setCustomDimensions(dimensions: Record<string, unknown>): void {
    _customDimensions = { ...(_customDimensions ?? {}), ...dimensions };
  },

  /**
   * Start a new session (generates new sessionId).
   */
  async startSession(): Promise<string> {
    const storage = await getStorage();
    _sessionId = randomId('sess');
    await storage.setItem('umami:sessionId', _sessionId);
    return _sessionId;
  },

  /**
   * End current session (keeps last sessionId stored but marks end logically).
   */
  async endSession(): Promise<void> {
    // For analytics consistency we keep the id but could rotate on next start
    // Optionally emit a session end event
    try {
      await this.track({ name: 'session_end', url: '/session' });
    } catch {}
  },

  /**
   * Convenience wrappers
   */
  async trackScreen(name: string): Promise<void> {
    await this.track({ name: 'ScreenView', url: `/${name}`, title: name });
  },
  async trackPurchase(amount: number, currency?: string, data?: Record<string, unknown>): Promise<void> {
    await this.track({ name: 'Purchase', url: '/purchase', data: { amount, currency, ...data } });
  },
  async trackError(name: string, message?: string, data?: Record<string, unknown>): Promise<void> {
    await this.track({ name: 'Error', url: '/error', title: name, data: { message, ...data } });
  },
};