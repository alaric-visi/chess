import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // Pages render WebGL; keep parallelism low so timing-sensitive tests stay reliable.
  workers: 1,
  use: { baseURL: 'http://localhost:4179' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Headless Chromium otherwise renders WebGL in software (SwiftShader),
        // where a single frame of this scene can take over a second. On macOS,
        // use the real GPU through Metal.
        launchOptions:
          process.platform === 'darwin'
            ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }
            : {},
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4179 --strictPort',
    url: 'http://localhost:4179',
    reuseExistingServer: true,
  },
});
