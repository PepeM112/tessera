import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = resolve(import.meta.dirname, "../src");

export default defineConfig({
  root: import.meta.dirname,
  // A fixed port, because 5173 is the default of other Vite apps. The e2e tests start their own server on 5191.
  server: { port: 5190 },
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^tessera$/, replacement: resolve(src, "index.ts") },
      { find: /^tessera\/styles\.css$/, replacement: resolve(src, "styles.css") },
    ],
  },
});
