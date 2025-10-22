import { NavigationContainerRef } from '@react-navigation/native';
import { UmamiTracker } from './UmamiTracker';

let routeNameRef: string | undefined;

export function onNavigationReady(navRef: NavigationContainerRef<any>) {
  routeNameRef = navRef.getCurrentRoute()?.name;
}

export function onNavigationStateChange(navRef: NavigationContainerRef<any>) {
  const previousRoute = routeNameRef;
  const currentRoute = navRef.getCurrentRoute()?.name;

  if (currentRoute && currentRoute !== previousRoute) {
    UmamiTracker.track({
      name: 'ScreenView',
      url: `/${currentRoute}`,
      referrer: previousRoute ? `/${previousRoute}` : undefined,
      title: currentRoute,
    });
  }

  routeNameRef = currentRoute;
}