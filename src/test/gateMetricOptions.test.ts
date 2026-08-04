import { describe, it, expect } from "vitest";
import { firstMetricValue, NSV_METRIC_VALUE } from "@/components/kpi-library/GateMetricOptions";
import type { MetricGroups } from "@/lib/saleshubApi";

describe("firstMetricValue", () => {
  it("picks the first metric from the first configured group", () => {
    const groups: MetricGroups = {
      attendance: [
        { name: "Absent days", gateCode: "ABSENT_DAYS" },
        { name: "Attendance %", gateCode: "ATTENDANCE_PCT" },
      ],
      collection: [{ name: "Collection %", gateCode: "COLLECTION_PCT" }],
    };
    expect(firstMetricValue(groups)).toBe("attendance::ABSENT_DAYS");
  });

  it("skips empty groups", () => {
    const groups: MetricGroups = {
      attendance: [],
      collection: [{ name: "Collection %", gateCode: "COLLECTION_PCT" }],
    };
    expect(firstMetricValue(groups)).toBe("collection::COLLECTION_PCT");
  });

  it("no longer falls back to NSV when config has no metric groups", () => {
    // NSV was removed as a gate option, so there is no implicit default left —
    // an empty string means "nothing selected" rather than silently gating on a
    // metric the user never chose.
    expect(firstMetricValue({})).toBe("");
    expect(firstMetricValue({})).not.toBe(NSV_METRIC_VALUE);
  });
});
