import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/**/types.ts', 'dist/**'],
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 70,
        lines: 65,
      },
    },
  },
});
