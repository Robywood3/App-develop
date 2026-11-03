import { defineConfig } from '@playwright/test';

// E2E against the real backend + simulated HA (see tests/e2e/start-stack.sh).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173', ignoreHTTPSErrors: Boolean(process.env.E2E_BASE_URL) },
  projects: [
    { name: 'tv', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'tablet', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'telefono', use: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } },
  ],
});
