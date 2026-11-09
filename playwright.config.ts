import { defineConfig, devices } from "@playwright/test";
const port = process.env.PLAYWRIGHT_PORT ?? "5180";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 30000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
