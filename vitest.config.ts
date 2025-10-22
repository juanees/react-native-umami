import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'test/mocks/react-native.ts'),
      '@react-navigation/native': path.resolve(
        __dirname,
        'test/mocks/react-navigation-native.ts'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage'
    },
    setupFiles: ['./vitest.setup.ts']
  }
});
