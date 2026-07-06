import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxies the rules engine so the browser avoids CORS in dev.
      // `/incentive-api/v1/rules` → `https://incentive-uat.salescode.ai/v1/rules`.
      "/incentive-api": {
        target: "https://incentive-uat.salescode.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/incentive-api/, ""),
      },
      // Proxies SalesHub master-data so the browser avoids CORS in dev.
      // `/saleshub-api/outlets/stats` → `https://api.salescodeai.com/outlets/stats`.
      "/saleshub-api": {
        target: "https://api.salescodeai.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/saleshub-api/, ""),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
