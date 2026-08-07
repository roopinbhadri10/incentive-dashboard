// ============================================
// Incentive Engine Plugin Build Config
// ============================================
// Produces a self-contained ESM bundle for embedding in the Salescode shell.
// Output: dist-plugin/incentive-plugin.[hash].js
//
//   vite.config.ts         → standalone SPA
//   vite.plugin.config.ts  → ESM library (embedded in the Next.js shell)
//
// Shell contract: bundle must export { manifest, mount, unmount }.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import prefixSelector from "postcss-prefix-selector";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [
    react(),
    // Inline all CSS into the JS bundle — the shell loads only the .js and
    // styles auto-apply on mount().
    cssInjectedByJsPlugin(),
  ],

  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
        // Scope EVERY selector under `.incentive-scope` so the plugin's styles
        // never bleed into the shell (and vice-versa). Design tokens are moved
        // off :root onto the wrapper so they can't clobber the host's tokens.
        prefixSelector({
          prefix: ".incentive-scope",
          transform(prefix: string, selector: string, prefixedSelector: string) {
            // CSS-var roots → the wrapper itself (not global :root).
            if (selector === ":root") return prefix;
            // Element / universal selectors (html, body, *, resets) → prefixed
            // as an ancestor (won't match the host's html/body).
            if (!selector.startsWith(".")) return prefixedSelector;
            // Class selectors → BOTH descendant and compound forms, so a rule
            // matches whether the class is on a descendant of `.incentive-scope`
            // OR on the same element (body-level portals get `.incentive-scope`
            // added by the mount observer while already carrying utility/.dark
            // classes). Example `.bg-background`:
            //   `.incentive-scope .bg-background, .incentive-scope.bg-background`
            return `${prefixedSelector}, ${prefix}${selector}`;
          },
        }),
      ],
    },
  },

  resolve: {
    // Force a single React instance — two copies make useState() throw.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  // Library mode skips process.env replacement; patch the common refs. Also
  // flip the plugin flag and bake absolute backend base URLs so the bundled
  // plugin calls the real services directly (the standalone app relies on the
  // Vite dev proxy / Netlify redirects, which don't exist inside the shell).
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": JSON.stringify({}),
    __IS_PLUGIN__: JSON.stringify(true),
    "import.meta.env.VITE_RULES_ENDPOINT": JSON.stringify(
      "https://incentive-uat.salescode.ai/v1/rules",
    ),
    "import.meta.env.VITE_INCENTIVE_CONFIG_BASE_URL": JSON.stringify(
      "https://incentive-uat.salescode.ai/v1",
    ),
    "import.meta.env.VITE_SALESHUB_BASE_URL": JSON.stringify("https://api.salescodeai.com"),
  },

  build: {
    lib: {
      entry: path.resolve(__dirname, "src/plugin-entry.tsx"),
      formats: ["es"],
    },
    outDir: "dist-plugin",
    rollupOptions: {
      output: {
        entryFileNames: "incentive-plugin.[hash].js",
      },
    },
    sourcemap: true,
  },
});
