// Auth context sourced from the parent portal.
//
// When this dashboard is embedded inside the host portal
// (platform.salescodeai.com), the parent sets two cookies with
// domain=.salescodeai.com so they are readable on every subdomain:
//   ACCOUNT_ID     → the tenant / account id  (e.g. "Emami")
//   SALESHUB_TOKEN → the bearer auth token
//
// `syncAuthFromCookies()` copies these into localStorage once at startup;
// `getTenantId()` / `getAccessToken()` are then read per API call. Reading
// per-call (not at module load) matters: the cookie may only be available
// after the parent finishes its own auth, and some code paths read auth
// before the first render.

/** Read a cookie value by name. Returns '' when absent. */
function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Sync accountId & authToken from the shared parent-portal cookies into
 * localStorage. Call this once at app startup, before any API call is made.
 */
export function syncAuthFromCookies(): void {
  const accountId = getCookie("ACCOUNT_ID");
  const authToken = getCookie("SALESHUB_TOKEN");

  if (accountId) {
    localStorage.setItem("accountId", accountId);
  }
  if (authToken) {
    localStorage.setItem("authToken", authToken);
  }
}

/** The bearer token, without the "Bearer " prefix. '' when not yet available. */
export function getAccessToken(): string {
  return localStorage.getItem("authToken") || "";
}

/** The tenant / account id. '' when not yet available. */
export function getTenantId(): string {
  return localStorage.getItem("accountId") || "";
}

/** `Authorization` header value, normalised to include the "Bearer " prefix. */
export function getAuthorizationHeader(): string {
  const token = getAccessToken();
  if (!token) return "";
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}
