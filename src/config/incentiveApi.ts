// Where the incentive backend lives.
//
// Every incentive call — rules, programme analytics, UI configs — is served by one
// host under one `/v1` prefix, and the paths below it are fixed by the API
// contract, not by config. So there is exactly ONE thing to configure:
//
//   VITE_INCENTIVE_API_BASE_URL — e.g. https://incentive-uat.salescode.ai/v1
//
// It defaults to the Vite dev-server proxy path (see `server.proxy` in
// vite.config.ts) so the browser stays same-origin and avoids CORS in dev.
//
// This used to be three independent full-URL variables (VITE_RULES_ENDPOINT,
// VITE_ANALYTICS_ENDPOINT, VITE_INCENTIVE_CONFIG_BASE_URL), which meant a
// deployment could be half-configured: setting two of them left the third on the
// relative dev default, and on CloudFront nothing rewrites that path, so the SPA
// fallback answered with index.html instead of JSON and every analytics figure
// silently read "Awaiting data". One base URL makes that state unreachable.
//
// The three legacy variables are still honoured as per-endpoint overrides so an
// environment that sets them keeps working, and so a single endpoint can be
// pointed elsewhere for debugging. Prefer the base URL.

const BASE = import.meta.env.VITE_INCENTIVE_API_BASE_URL ?? "/incentive-api/v1";

/** `${BASE}/rules`, unless VITE_RULES_ENDPOINT overrides it outright. */
export const RULES_ENDPOINT: string =
  import.meta.env.VITE_RULES_ENDPOINT ?? `${BASE}/rules`;

/** `${BASE}/programs/analytics`, unless VITE_ANALYTICS_ENDPOINT overrides it. */
export const ANALYTICS_ENDPOINT: string =
  import.meta.env.VITE_ANALYTICS_ENDPOINT ?? `${BASE}/programs/analytics`;

/**
 * The config service root — callers append their own path (`/ui-configs`).
 * VITE_INCENTIVE_CONFIG_BASE_URL overrides it.
 */
export const INCENTIVE_CONFIG_BASE_URL: string =
  import.meta.env.VITE_INCENTIVE_CONFIG_BASE_URL ?? BASE;
