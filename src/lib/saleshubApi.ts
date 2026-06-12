// SalesHub API client — fetches master data from api.salescodeai.com.
//
// Override via env vars:
//   VITE_SALESHUB_BASE_URL  — defaults to https://api.salescodeai.com
//   VITE_SALESHUB_TOKEN     — Bearer token for Authorization header
//   VITE_SALESHUB_TENANT_ID — value for X-Tenant-Id header

const SALESHUB_BASE_URL =
  import.meta.env.VITE_SALESHUB_BASE_URL ?? "https://api.salescodeai.com";

const SALESHUB_TOKEN =
  import.meta.env.VITE_SALESHUB_TOKEN ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3ODEyNzk3NzYsImV4cCI6MTc4MTMxNTc3NiwidGVuYW50X2lkIjoiRW1hbWkiLCJ1c2VyX2lkIjoxNDcwNzgsInVzZXJuYW1lIjoiRW1hbWkiLCJvcmdfdHlwZSI6bnVsbCwib3JnX2NvZGUiOm51bGwsImRlZmF1bHRfY3JlZHMiOnRydWUsInJvbGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJqdGkiOiJlYTYxOWMxNC00MTQ0LTQxM2EtOWM4Ny0xODJlZDE5MmEzMDIifQ.gpSpEl8-Iq-VaMnIw_TBw3iXtyLuJtnC_kpOjQLKFLc";

const SALESHUB_TENANT_ID =
  import.meta.env.VITE_SALESHUB_TENANT_ID ?? "Emami";

function saleshubHeaders(): HeadersInit {
  return {
    accept: "application/json, text/plain, */*",
    authorization: `Bearer ${SALESHUB_TOKEN}`,
    "x-tenant-id": SALESHUB_TENANT_ID,
  };
}

export interface OutletChannelStat {
  channel: string;
  count: number;
}

export interface OutletStats {
  total: number;
  active: number;
  inactive: number;
  byChannel: OutletChannelStat[];
}

/** Fetch outlet stats including channel breakdown. */
export async function fetchOutletStats(): Promise<OutletStats> {
  const res = await fetch(`${SALESHUB_BASE_URL}/outlets/stats`, {
    headers: saleshubHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /outlets/stats responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }

  return res.json() as Promise<OutletStats>;
}

/**
 * Fetch channel names from outlet stats.
 * Filters out numeric-only and "UNKNOWN" entries that are junk data.
 */
export async function fetchChannelNames(): Promise<string[]> {
  const stats = await fetchOutletStats();
  //  return stats.byChannel
  //   .filter((c) => c.channel && !/^\d+$/.test(c.channel) && c.channel.toUpperCase() !== "UNKNOWN")
  //   .map((c) => c.channel);
   return stats.byChannel.map((c) => c.channel);
}

export interface SaleshubRole {
  id: number;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/** Fetch all roles for the configured tenant. Returns role names sorted alphabetically. */
export async function fetchRoles(): Promise<SaleshubRole[]> {
  const res = await fetch(`${SALESHUB_BASE_URL}/roles`, {
    headers: saleshubHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /roles responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }

  const data = await res.json();
  const roles: SaleshubRole[] = Array.isArray(data) ? data : [];
  return roles.sort((a, b) => a.name.localeCompare(b.name));
}

/** Convenience — returns just the role name strings. */
export async function fetchRoleNames(): Promise<string[]> {
  const roles = await fetchRoles();
  return roles.map((r) => r.name);
}
