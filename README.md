# react-native-umami

A simple React Native client for [Umami analytics](https://umami.is), modeled after `@umami/node`.

## Installation
```bash
npm install react-native-umami
```

## Usage
```ts
import { UmamiTracker } from 'react-native-umami';

UmamiTracker.init({
  websiteId: 'YOUR_UMAMI_SITE_ID',
  hostUrl: 'https://umami.example.com',
});

UmamiTracker.track({
  url: '/home',
  name: 'AppOpened',
  data: { theme: 'dark' },
});
```

### React Hook
```ts
import { useUmamiEvent } from 'react-native-umami';

function Screen() {
  useUmamiEvent('ProductScreenView', { url: '/product/123' });
  return null;
}
```

### React Navigation auto tracking
```ts
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  UmamiTracker,
  onNavigationReady,
  onNavigationStateChange,
  useUmamiEvent,
} from 'react-native-umami';

const Stack = createNativeStackNavigator();

const HomeScreen = () => {
  useUmamiEvent('HomeScreenView', { url: '/home' });
  return null;
};

const ProfileScreen = () => {
  useUmamiEvent('ProfileScreenView', { url: '/profile' });
  return null;
};

export default function App() {
  const navRef = useRef(null);

  useEffect(() => {
    UmamiTracker.init({
      websiteId: '50429a93-8479-4073-be80-d5d29c09c2ec',
      hostUrl: 'https://umami.mywebsite.com',
    });
  }, []);

  return (
    <NavigationContainer
      ref={navRef}
      onReady={() => onNavigationReady(navRef.current!)}
      onStateChange={() => onNavigationStateChange(navRef.current!)}
    >
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

**License:** Apache 2.0
© 2025 juanees