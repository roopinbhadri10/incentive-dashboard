import type { IncentiveProgram, ProgramKPI, PayoutTier } from "@/data/mockData";

export interface AIChange {
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  type: "improved" | "dropped" | "kept";
}

export interface ClonedProgram {
  original: IncentiveProgram;
  changes: AIChange[];
  improvedKpis: ProgramKPI[];
  improvedPayoutTiers: PayoutTier[];
}

export function generateAIClone(program: IncentiveProgram): ClonedProgram {
  const changes: AIChange[] = [];
  const improvedKpis = [...program.kpis];
  const improvedPayoutTiers = [...program.payoutTiers];

  // Find weakest KPI and suggest dropping it
  const sortedKpis = [...program.kpis].sort((a, b) => a.attainment - b.attainment);
  const weakest = sortedKpis[0];
  if (weakest && weakest.attainment < 50) {
    changes.push({
      field: `KPI: ${weakest.name}`,
      oldValue: `${weakest.attainment}% attainment, ${weakest.weight}% weight`,
      newValue: "Removed",
      reason: `Only ${weakest.attainment}% attainment — too hard, demotivates reps`,
      type: "dropped",
    });
    const idx = improvedKpis.findIndex(k => k.name === weakest.name);
    if (idx >= 0) {
      // Redistribute weight
      const removedWeight = improvedKpis[idx].weight;
      improvedKpis.splice(idx, 1);
      const perKpi = Math.round(removedWeight / improvedKpis.length);
      improvedKpis.forEach(k => k.weight += perKpi);
    }
  }

  // Find KPIs near threshold and suggest keeping
  const strongest = sortedKpis[sortedKpis.length - 1];
  if (strongest && strongest.attainment >= 70) {
    changes.push({
      field: `KPI: ${strongest.name}`,
      oldValue: `${strongest.attainment}% attainment`,
      newValue: "Kept — increase target by 10%",
      reason: `Top performer at ${strongest.attainment}% — reps can handle a stretch`,
      type: "kept",
    });
  }

  // Payout tier adjustment — bump mid-tier slightly at program level AND
  // proportionally on each KPI's mid-tier so the KPI × Tier matrix stays in sync.
  if (improvedPayoutTiers.length >= 2) {
    const midIdx = Math.floor(improvedPayoutTiers.length / 2);
    const midTier = improvedPayoutTiers[midIdx];
    const oldPayout = midTier.payoutPerRep;
    const newPayout = Math.round((oldPayout * 1.1) / 100) * 100;
    changes.push({
      field: `Payout: ${midTier.label}`,
      oldValue: `₹${oldPayout.toLocaleString()}/rep`,
      newValue: `₹${newPayout.toLocaleString()}/rep`,
      reason: "41% reps missed this tier by <5% — small bump improves motivation",
      type: "improved",
    });
    midTier.payoutPerRep = newPayout;

    // Apply proportional bump to each KPI's mid-tier payout
    improvedKpis.forEach(k => {
      if (k.payoutTiers[midIdx]) {
        const old = k.payoutTiers[midIdx].payoutPerRep;
        k.payoutTiers[midIdx] = {
          ...k.payoutTiers[midIdx],
          payoutPerRep: Math.max(50, Math.round((old * 1.1) / 50) * 50),
        };
      }
    });
  }

  // KPI-level payout suggestion — boost the strongest KPI's top tier to
  // reward stretch performance on the lever that's already working.
  if (strongest && strongest.attainment >= 70) {
    const targetKpi = improvedKpis.find(k => k.name === strongest.name);
    if (targetKpi && targetKpi.payoutTiers.length > 0) {
      const topIdx = targetKpi.payoutTiers.length - 1;
      const topTier = targetKpi.payoutTiers[topIdx];
      const oldPay = topTier.payoutPerRep;
      const newPay = Math.max(50, Math.round((oldPay * 1.2) / 50) * 50);
      changes.push({
        field: `KPI Payout: ${strongest.name} → ${topTier.label}`,
        oldValue: `₹${oldPay.toLocaleString()}/rep`,
        newValue: `₹${newPay.toLocaleString()}/rep`,
        reason: `Top performer at ${strongest.attainment}% — over-reward the stretch tier to keep momentum`,
        type: "improved",
      });
      targetKpi.payoutTiers[topIdx] = { ...topTier, payoutPerRep: newPay };
    }
  }

  // Budget utilization
  if (program.budgetUtilized < 60) {
    changes.push({
      field: "Budget Allocation",
      oldValue: `${program.budgetUtilized}% utilized`,
      newValue: "Reduce budget by 15%",
      reason: `Low utilization (${program.budgetUtilized}%) — reallocate unused funds`,
      type: "improved",
    });
  } else if (program.budgetUtilized > 85) {
    changes.push({
      field: "Budget Allocation",
      oldValue: `${program.budgetUtilized}% utilized`,
      newValue: "Increase budget by 10%",
      reason: "Near-full utilization — add headroom to avoid capping top performers",
      type: "improved",
    });
  }

  return { original: program, changes, improvedKpis, improvedPayoutTiers };
}
