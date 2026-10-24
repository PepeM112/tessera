import { resolve } from "path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const sharedAlias = { "@shared": resolve("src/shared") };

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
  },
  renderer: {
    resolve: {
      alias: { ...sharedAlias, "@": resolve("src/renderer/src") },
    },
    plugins: [tailwindcss(), react()],
  },
});
