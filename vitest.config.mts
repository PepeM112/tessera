import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Pure tests run in Node. Render tests run in real Chromium, because jsdom has no layout engine.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.test.tsx"],
          // The library CSS gives the real flex layout. It is a setup file, so the test files need no CSS import.
          setupFiles: ["src/styles.css"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            viewport: { width: 1024, height: 768 },
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
