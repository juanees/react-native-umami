export interface UmamiInitOptions {
  websiteId: string;
  hostUrl: string; // e.g., https://umami.mywebsite.com
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
}