import { UmamiInitOptions, UmamiTrackPayload } from './types';
import { Platform } from 'react-native';

let _websiteId: string | null = null;
let _hostUrl: string | null = null;

export const UmamiTracker = {
  /**
   * Initialize Umami client.
   */
  init({ websiteId, hostUrl }: UmamiInitOptions) {
    _websiteId = websiteId;
    _hostUrl = hostUrl.replace(/\/$/, '');
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

    const body = {
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
        data: payload.data,
      },
    };

    try {
      await fetch(`${_hostUrl}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn('[UmamiTracker] Failed to send event:', err);
    }
  },
};