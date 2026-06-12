// Map a saved Programme (domain) → BuilderState (wizard) for cloning into the
// full IncentiveWizard. KPIs that don't have a 1:1 wizard template are skipped.

import type { KpiConfig, Programme } from "@/types/programme";
import {
  emptyBuilder,
  type BuilderState,
  type ProgramKpi,
  uid,
} from "@/components/wizard/builderState";
import { KPI_TEMPLATE_MAP, type KpiTemplateId } from "@/components/kpi-library/registry";

const KPI_KEY_TO_TEMPLATE: Partial<Record<keyof Programme["kpis"], KpiTemplateId>> = {
  A_nsv: "nsv",
  B_phasing: "phasing",
  C_eco: "eco",
  D_tlsd: "tlsd",
  E_dbb: "dbb",
  L_quarterly: "qnsv",
};

export function programmeToBuilder(p: Programme): BuilderState {
  const programKpis: ProgramKpi[] = [];
  (Object.entries(p.kpis) as [keyof Programme["kpis"], KpiConfig | undefined][]).forEach(([k, v]) => {
    if (!v?.enabled) return;
    const templateId = KPI_KEY_TO_TEMPLATE[k];
    if (!templateId) return;
    const tpl = KPI_TEMPLATE_MAP[templateId];
    programKpis.push({
      templateId,
      instanceId: uid("kpi"),
      config: tpl.defaultConfig(),
    });
  });

  return {
    ...emptyBuilder,
    basics: {
      ...emptyBuilder.basics,
      name: `${p.name} — Copy`,
      month: p.period.month,
      year: p.period.year,
    },
    audience: {
      ...emptyBuilder.audience,
      division: p.channel,
      roles: [
        p.role === "ASO_ASE"
          ? "ASO/ASE"
          : p.role === "MR"
          ? "Urban Retail MR"
          : p.role,
      ],
      geographies: [p.geography === "all-india" ? "All regions" : p.geography],
    },
    programKpis,
  };
}
