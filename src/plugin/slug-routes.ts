// Translates the shell sidebar slug (declared in the plugin manifest and sent
// by the shell at mount + on each `shell:navigate` event) to this plugin's
// internal MemoryRouter path.
export const SLUG_TO_VIEW: Record<string, string> = {
  programs: "/programs",
  "campaigns-completed": "/campaigns/completed",
  "campaigns-drafts": "/campaigns/drafts",
  "clone-programs": "/programs", // matches the standalone app's "Clone programs" href
  wizard: "/create/wizard",
  performance: "/analytics/performance",
  roi: "/analytics/roi",
  reports: "/reports",
  users: "/users",
};

export const DEFAULT_VIEW = "/programs";

export function slugToPath(slug: string | undefined | null): string {
  if (!slug) return DEFAULT_VIEW;
  return SLUG_TO_VIEW[slug] ?? DEFAULT_VIEW;
}
