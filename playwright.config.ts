import { defineConfig, devices } from "@playwright/test";

// Its own port, not the 5190 of `make dev`: a test never runs against a server of another worktree.
const PORT = 5191;

// Chromium only: the target app (Electron) is Chromium. The playground gets a fixed viewport, so sizes are known.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
