import { describe, it, expect } from "vitest";
import { isCapInvalid, lastSlabBoundary, capValue } from "@/components/kpi-library/capValidation";

describe("cap validation", () => {
  it("reads the last slab boundary across slab shapes", () => {
    expect(lastSlabBoundary({ slabs: [{ pct: 95 }, { pct: 110 }] })).toBe(110);
    expect(lastSlabBoundary({ slabs: [{ count: 150 }, { count: 250 }] })).toBe(250);
    expect(lastSlabBoundary({ slabs: [{ threshold: 50 }, { threshold: 100 }] })).toBe(100);
    expect(lastSlabBoundary({})).toBeNull();
  });

  it("extracts the cap enabled flag and its KPI-specific value", () => {
    expect(capValue({ cap: { enabled: true, outlets: 300 } })).toEqual({ enabled: true, value: 300 });
    expect(capValue({ cap: { enabled: true, pct: 110 } })).toEqual({ enabled: true, value: 110 });
    expect(capValue({})).toEqual({ enabled: false, value: null });
  });

  it("flags a cap that is not strictly above the last slab", () => {
    // Cap at 250 with a top slab at 250 → invalid (must exceed it).
    expect(isCapInvalid({ slabs: [{ count: 200 }, { count: 250 }], cap: { enabled: true, outlets: 250 } })).toBe(true);
    // Cap below the top slab → invalid.
    expect(isCapInvalid({ slabs: [{ count: 200 }, { count: 250 }], cap: { enabled: true, outlets: 240 } })).toBe(true);
  });

  it("accepts a cap above the last slab, and never flags a disabled cap", () => {
    expect(isCapInvalid({ slabs: [{ count: 200 }, { count: 250 }], cap: { enabled: true, outlets: 300 } })).toBe(false);
    expect(isCapInvalid({ slabs: [{ count: 200 }, { count: 250 }], cap: { enabled: false, outlets: 100 } })).toBe(false);
    // No cap / no slabs → nothing to validate.
    expect(isCapInvalid({ slabs: [{ count: 250 }] })).toBe(false);
    expect(isCapInvalid({ cap: { enabled: true, outlets: 1 } })).toBe(false);
  });
});
