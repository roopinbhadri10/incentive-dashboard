// ============================================
// Write plugin manifest — run after vite build:plugin
// ============================================
// Emits dist-plugin/manifest.json pointing at the current hashed entry bundle.
// The shell fetches this (no-cache) to discover the live bundle URL and detect
// version changes for cache invalidation.

import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "dist-plugin";
const ENTRY_PATTERN = /^incentive-plugin\.[A-Za-z0-9_-]+\.js$/;

const entry = readdirSync(OUT_DIR).find((f) => ENTRY_PATTERN.test(f));
if (!entry) {
  console.error(
    `[write-plugin-manifest] No hashed entry matching ${ENTRY_PATTERN} in ${OUT_DIR}`,
  );
  process.exit(1);
}

const version =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.COMMIT_SHA ??
  new Date().toISOString();

const manifest = { version, bundle: entry, builtAt: new Date().toISOString() };
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[write-plugin-manifest] ${entry} @ ${String(version).slice(0, 12)}`);
