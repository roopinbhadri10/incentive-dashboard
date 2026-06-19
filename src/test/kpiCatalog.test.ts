// Guards the config-driven KPI catalog restructure: section-specific defaults
// now live on each section's `defaults` fragment (not a flat blob), and
// `buildCatalog` reassembles them into the per-instance value object. That value
// object's shape is load-bearing for rule-payload serialization, so it must come
// out exactly as the flat `defaultConfig` did before the restructure.

import { describe, it, expect } from "vitest";
import { buildCatalog } from "@/components/kpi-library/schema/kpiCatalog";
import { DUMMY_KPI_METAS } from "@/components/kpi-library/schema/dummyKpiConfig";

describe("buildCatalog — value-object reconstruction", () => {
  const catalog = buildCatalog(DUMMY_KPI_METAS);

  it("reassembles each KPI's value object from base + section defaults", () => {
    for (const meta of DUMMY_KPI_METAS) {
      // Independent reconstruction (mirrors buildCatalog) to compare against.
      const sections = (meta.defaultSection ?? []) as Array<
        Record<string, unknown> & { kind: string; defaults?: Record<string, unknown> }
      >;
      const expected: Record<string, unknown> =
        meta.dataFeed != null ? { dataFeed: meta.dataFeed } : {};
      for (const s of sections) {
        if (s.kind === "gates" && !s.defaults) {
          expected[s.enabledPath as string] ??= false;
          expected[s.gatesPath as string] ??= [];
        }
        if (s.defaults) Object.assign(expected, structuredClone(s.defaults));
      }
      const entry = catalog.entries[meta.id];
      expect(entry, `missing catalog entry for ${meta.id}`).toBeTruthy();
      expect(entry.defaultConfig(), `value object for ${meta.id}`).toEqual(expected);
    }
  });

  it("strips `defaults` from the schema the renderer reads", () => {
    for (const entry of Object.values(catalog.entries)) {
      for (const s of entry.meta.defaultSection ?? []) {
        expect(s).not.toHaveProperty("defaults");
      }
    }
  });

  it("matches known pre-restructure values (non-circular spot checks)", () => {
    const cfg = (id: string) => catalog.entries[id].defaultConfig() as Record<string, unknown>;
    const obj = (v: unknown) => v as Record<string, unknown>;

    // nsv — cap moved to the compact `cap` section, slabs to the slabs section.
    expect(cfg("nsv").cap).toEqual({ enabled: true, pct: 110 });
    expect(cfg("nsv").basis).toBe("primary");
    expect(cfg("nsv").slabs).toHaveLength(4);
    expect(cfg("nsv").gatesEnabled).toBe(false); // supplied by buildCatalog
    expect(cfg("nsv").gates).toEqual([]);

    // phasing — the only KPI with a real default gate; cut-off scalar restored.
    expect(cfg("phasing").cutoffDay).toBe(20);
    expect(cfg("phasing").gatesEnabled).toBe(true);
    expect(cfg("phasing").gates).toHaveLength(1);
    expect(cfg("phasing").cap).toEqual({ enabled: true, pct: 75 });

    // collection — `unit` rides with the slabs section, `dataFeed` stays in base.
    expect(cfg("collection").unit).toBe("pct");
    expect(cfg("collection").dataFeed).toBe("sfa");
    expect(cfg("collection").cap).toEqual({ enabled: true, value: 100 });

    // eco — cap value lives under `outlets`; every field maps to a section.
    expect(cfg("eco").cap).toEqual({ enabled: true, outlets: 300 });
    expect(cfg("eco").minBillAmount).toBe(250);
    expect(cfg("eco").role).toBe("mr");

    // ai_recommended_order — sub-metric objects restored intact.
    expect(obj(cfg("ai_recommended_order").crossSell).payoutBasis).toBe("monthly_pct");
    expect(obj(cfg("ai_recommended_order").recover).perLine).toEqual({ ratePerLine: 2, minLines: 50, maxLines: 1000 });
  });

  it("keeps every value-object key (no key lost to a section that owns none)", () => {
    // Every default that exists must survive into the cloned instance config.
    for (const meta of DUMMY_KPI_METAS) {
      const cfg = catalog.entries[meta.id].defaultConfig() as Record<string, unknown>;
      // Sanity: KPIs that have a slabs section expose `slabs`; gated KPIs expose gates.
      const kinds = new Set((meta.defaultSection ?? []).map((s) => s.kind));
      if (kinds.has("slabs")) expect(cfg).toHaveProperty("slabs");
      if (kinds.has("gates")) {
        expect(cfg).toHaveProperty("gatesEnabled");
        expect(cfg).toHaveProperty("gates");
      }
    }
  });
});
