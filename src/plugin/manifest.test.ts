import { describe, it, expect } from "vitest";
import { manifest, NAV_SLUGS } from "@/plugin/manifest";
import { SLUG_TO_VIEW } from "@/plugin/slug-routes";

describe("incentive plugin manifest", () => {
  it("has the expected identity", () => {
    expect(manifest.id).toBe("plugin-incentive");
    expect(manifest.defaultSidebarSlug).toBe("campaigns-all");
    expect(manifest.sidebar.length).toBeGreaterThan(0);
  });

  it("every navigable leaf slug resolves to a route", () => {
    for (const slug of NAV_SLUGS) {
      expect(SLUG_TO_VIEW[slug], `slug "${slug}" missing from SLUG_TO_VIEW`).toBeDefined();
    }
  });

  it("has no route mapped to a slug the sidebar dropped", () => {
    // The reverse of the check above: a slug left in SLUG_TO_VIEW after its
    // sidebar row is gone is unreachable, and hides that a page lost its nav.
    for (const slug of Object.keys(SLUG_TO_VIEW)) {
      expect(NAV_SLUGS, `slug "${slug}" has a route but no sidebar row`).toContain(slug);
    }
  });

  it("the default slug is navigable", () => {
    expect(NAV_SLUGS).toContain(manifest.defaultSidebarSlug);
  });

  it("exposes the real app's top-level nav as shell GROUPS, not nested items", () => {
    expect(manifest.sidebar.map((g) => g.group)).toEqual(["CAMPAIGNS", "CREATE", "MAIN"]);
    expect(manifest.sidebar.map((g) => g.groupLabel)).toEqual([
      "Campaigns",
      "Create",
      "", // trailing utility items render with no group header
    ]);
    // The standalone rail's `_`-prefixed accordion parents are gone: nesting
    // inside a single group is what made this sidebar look unlike every other
    // product's. Every row is a leaf the shell renders as a plain nav item.
    for (const group of manifest.sidebar) {
      for (const item of group.items) {
        expect(item.children, `"${item.slug}" reintroduced nesting`).toBeUndefined();
        expect(item.slug.startsWith("_")).toBe(false);
      }
    }
  });

  it("gives every group and item an icon the shell can render", () => {
    for (const group of manifest.sidebar) {
      // Only a LABELLED group draws a header, so only it needs an icon.
      if (group.groupLabel) expect(group.icon, `group ${group.group}`).toBeTruthy();
      for (const item of group.items) {
        expect(item.icon, `item ${item.slug}`).toBeTruthy();
      }
    }
  });
});
