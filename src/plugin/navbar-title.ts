// Maps the plugin's internal MemoryRouter path → the title shown in the shell's
// top NavBar (left slot). Mirrors the section names in the plugin manifest so the
// bar reads the same as the sidebar the user clicked from.

// Order matters: the first match wins, so narrower paths come before the
// prefixes that would also match them (/users-directory before /users).
const PATH_TITLES: Array<[test: RegExp, title: string]> = [
  [/^\/programs\/[^/]+\/analytics\b/, "Programme Analytics"],
  [/^\/programs\b/, "Campaigns"],
  [/^\/campaigns\/active\b/, "Active Campaigns"],
  [/^\/campaigns\/scheduled\b/, "Scheduled Campaigns"],
  [/^\/campaigns\/draft\b/, "Draft Campaigns"],
  [/^\/campaigns\/completed\b/, "Completed Campaigns"],
  [/^\/campaigns\/inactive\b/, "Archived Campaigns"],
  [/^\/campaigns\b/, "Campaigns"],
  [/^\/create\/wizard\b/, "Create Program"],
  [/^\/create\b/, "Create Program"],
  [/^\/clone\b/, "Clone Program"],
  [/^\/analytics\b/, "Analytics"],
  [/^\/payout-management\b/, "Payout Management"],
  [/^\/kpi-library\b/, "KPI Library"],
  [/^\/reports\b/, "Reports"],
  [/^\/users-directory\b/, "Users Directory"],
  [/^\/users\b/, "Users List"],
];

const DEFAULT_TITLE = "Sales Incentive";

/** Title for the shell NavBar given the plugin's current path. Falls back to the
 *  product name for unknown paths so the bar is never blank. */
export function titleForPath(pathname: string | undefined | null): string {
  if (!pathname) return DEFAULT_TITLE;
  for (const [test, title] of PATH_TITLES) {
    if (test.test(pathname)) return title;
  }
  return DEFAULT_TITLE;
}
