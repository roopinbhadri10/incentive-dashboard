// Maps the plugin's internal MemoryRouter path → the title shown in the shell's
// top NavBar (left slot). Mirrors the section names in the plugin manifest so the
// bar reads the same as the sidebar the user clicked from.

const PATH_TITLES: Array<[test: RegExp, title: string]> = [
  [/^\/programs\b/, "Campaigns"],
  [/^\/campaigns\/completed\b/, "Completed Campaigns"],
  [/^\/campaigns\/drafts\b/, "Draft Campaigns"],
  [/^\/create\/wizard\b/, "Create Program"],
  [/^\/create\b/, "Create Program"],
  [/^\/analytics\/performance\b/, "Performance"],
  [/^\/analytics\/roi\b/, "ROI Analysis"],
  [/^\/analytics\b/, "Analytics"],
  [/^\/reports\b/, "Reports"],
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
