import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = resolve(import.meta.dirname, "../src");

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^tessera$/, replacement: resolve(src, "index.ts") },
      { find: /^tessera\/styles\.css$/, replacement: resolve(src, "styles.css") },
    ],
  },
});
