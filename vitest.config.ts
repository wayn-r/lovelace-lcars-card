import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use global APIs like describe, it, expect
    environment: 'happy-dom', // Or 'jsdom' if you prefer
    // setupFiles: ['./vitest.setup.ts'], // Optional: for global test setup
    alias: {
      '@src/': new URL('./src/', import.meta.url).pathname,
    },
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: { // Optional: for code coverage
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
    },
    // Add this section for reporters
    reporters: [
      'default', // Keep the default console reporter
      ['junit', {
        outputFile: 'test-results.xml',
        // You can add other JUnit specific options here if needed
        // suiteName: 'My Awesome Project Tests',
        // classNameFormat: ({ Crayon }) => Crayon`{classname}`, // Example, refer to Vitest docs for full options
      }]
    ],
  },
});