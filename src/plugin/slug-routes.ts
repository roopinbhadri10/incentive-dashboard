// Translates the shell sidebar slug (declared in the plugin manifest and sent
// by the shell at mount + on each `shell:navigate` event) to this plugin's
// internal MemoryRouter path.
export const SLUG_TO_VIEW: Record<string, string> = {
  // Campaigns — one slug per status the programmes list filters by. The
  // `:status` segment is what drives that filter (see ProgramsRoute).
  "campaigns-all": "/campaigns/all",
  "campaigns-active": "/campaigns/active",
  "campaigns-scheduled": "/campaigns/scheduled",
  "campaigns-draft": "/campaigns/draft",
  "campaigns-completed": "/campaigns/completed",
  "campaigns-archived": "/campaigns/inactive",
  "clone-programs": "/programs", // matches the standalone app's "Clone programs" href
  wizard: "/create/wizard",
  analytics: "/analytics",
  "payout-management": "/payout-management",
  reports: "/reports",
  users: "/users",
  "users-directory": "/users-directory",
};

export const DEFAULT_VIEW = "/campaigns/all";

export function slugToPath(slug: string | undefined | null): string {
  if (!slug) return DEFAULT_VIEW;
  return SLUG_TO_VIEW[slug] ?? DEFAULT_VIEW;
}
