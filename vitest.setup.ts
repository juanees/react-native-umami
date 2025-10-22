// jsdom and global mocks for RN-like environment
import { vi } from 'vitest';

// Minimal window and navigator defaults if missing
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.innerWidth = window.innerWidth || 1024;
  // @ts-ignore
  window.innerHeight = window.innerHeight || 768;
}

// Mock react-native Platform used by UmamiTracker
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock @react-navigation/native to avoid runtime import during tests
vi.mock('@react-navigation/native', () => ({}));
