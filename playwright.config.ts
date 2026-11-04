import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run build && npm run preview -- --port 4331 --ignore-lock",
    url: "http://localhost:4331",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: { baseURL: "http://localhost:4331" },
});
