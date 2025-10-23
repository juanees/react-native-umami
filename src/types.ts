export interface UmamiInitOptions {
  websiteId: string;
  hostUrl: string; // e.g., https://umami.mywebsite.com

  // Optional: enrich events with device information
  appVersion?: string;
  deviceInfoProvider?: () => Promise<DeviceInfo> | DeviceInfo;

  // Optional: persistence and network hooks
  storage?: KeyValueStorage;
  network?: NetworkOptions;

  // Optional: batching and retry configuration
  batching?: BatchingOptions;
  retry?: RetryOptions;

  // Optional: override endpoints (relative to hostUrl)
  sendPath?: string; // default: /api/send
  batchPath?: string; // default: /api/send/batch
}

export interface UmamiTrackPayload {
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
  name?: string;
  data?: Record<string, unknown>;

  // Enhancements
  sessionId?: string;
  userId?: string;
  anonymousId?: string;
  userProperties?: Record<string, unknown>;
  customDimensions?: Record<string, unknown>;
}

export interface IdentifyPayload {
  userId: string;
  userProperties?: Record<string, unknown>;
}

export interface DeviceInfo {
  os: string; // e.g., ios, android, web
  osVersion?: string;
  model?: string;
  appVersion?: string;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface RetryOptions {
  retries?: number; // default 5
  minDelayMs?: number; // default 1000
  maxDelayMs?: number; // default 30000
  factor?: number; // default 2
  jitter?: boolean; // default true
}

export interface BatchingOptions {
  enabled?: boolean; // default false
  maxBatchSize?: number; // default 20
  maxIntervalMs?: number; // default 10000
}

export interface NetworkOptions {
  isOnline?: () => Promise<boolean> | boolean;
  addListener?: (callback: (online: boolean) => void) => () => void;
}