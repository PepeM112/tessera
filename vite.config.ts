import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    rolldownOptions: { external: ["react", "react-dom", "react/jsx-runtime"] },
    sourcemap: true,
  },
});
