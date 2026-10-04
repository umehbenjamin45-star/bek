import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', browserName:'chromium', launchOptions: {
    executablePath: process.env.CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  } },
  webServer: {
    command: 'npm run dev -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer:false,
    env: { NEXT_BUILD_DIR: '.next-browser', NEXT_PUBLIC_SUPABASE_URL: 'https://browser-fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' },
  },
});
