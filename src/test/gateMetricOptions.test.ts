import { describe, it, expect } from "vitest";
import { firstMetricValue, NSV_METRIC_VALUE } from "@/components/kpi-library/GateMetricOptions";
import { blankCondition } from "@/components/wizard/steps/GateRulesStep";
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

describe("blankCondition", () => {
  it("preselects the first metric the config offers", () => {
    const groups: MetricGroups = {
      attendance: [{ name: "Present days", gateCode: "PRESENT_DAYS" }],
      field_activity: [{ name: "Avg CFT hours", gateCode: "CFT_HOURS" }],
    };
    expect(blankCondition(groups)).toMatchObject({
      metricGroup: "attendance",
      metric: "PRESENT_DAYS",
    });
  });

  it("does not hardcode a metric absent from the catalog", () => {
    // Regression: the step used to seed attendance/ABSENT_DAYS, which rendered an
    // empty picker on any tenant whose config omits that gate code.
    const groups: MetricGroups = {
      attendance: [{ name: "Present days", gateCode: "PRESENT_DAYS" }],
    };
    expect(blankCondition(groups).metric).not.toBe("ABSENT_DAYS");
  });

  it("leaves the metric empty when config has loaded no groups", () => {
    expect(blankCondition({})).toMatchObject({ metricGroup: "", metric: "" });
  });
});
