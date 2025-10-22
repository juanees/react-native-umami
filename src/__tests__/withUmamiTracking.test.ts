import { describe, expect, it, vi, beforeEach } from 'vitest';
import { onNavigationReady, onNavigationStateChange } from '../withUmamiTracking';
import { UmamiTracker } from '../UmamiTracker';

const mockNavRef = (routeName: string) => ({
  getCurrentRoute: () => ({ name: routeName }),
});

describe('withUmamiTracking navigation handlers', () => {
  beforeEach(() => {
    UmamiTracker.init({ websiteId: 'site-1', hostUrl: 'https://umami.test' });
    vi.restoreAllMocks();
    vi.spyOn(UmamiTracker, 'track').mockResolvedValue();
  });

  it('records initial route on ready', () => {
    onNavigationReady(mockNavRef('Home') as any);
    // No Umami call on ready alone
    expect(UmamiTracker.track).not.toHaveBeenCalled();
  });

  it('tracks when route changes', () => {
    const nav = mockNavRef('Home') as any;
    onNavigationReady(nav);

    // Change route
    const nav2 = mockNavRef('Profile') as any;
    onNavigationStateChange(nav2);

    expect(UmamiTracker.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ScreenView',
        url: '/Profile',
        title: 'Profile',
        referrer: '/Home',
      })
    );
  });

  it('does not track when route unchanged', () => {
    const nav = mockNavRef('Home') as any;
    onNavigationReady(nav);
    onNavigationStateChange(nav);
    expect(UmamiTracker.track).not.toHaveBeenCalled();
  });
});
