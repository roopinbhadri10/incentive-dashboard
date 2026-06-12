export interface SalesRep {
  id: string;
  name: string;
  region: string;
  territory: string;
  outlets: number;
}

export interface Outlet {
  id: string;
  name: string;
  region: string;
  channel: string;
  salesRep: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  packSize: string;
  sku: string;
  price: number;
  imageEmoji: string;
  crossSellOpportunity?: number;
  distributionOpportunity?: number;
  salesUplift?: number;
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  category: "sales" | "distribution" | "visibility" | "compliance" | "custom";
  formula?: string;
  isAISuggested?: boolean;
  aiReason?: string;
}

export interface AIInsight {
  type: "keep" | "improve" | "drop";
  text: string;
}

export interface IncentivePlan {
  id: string;
  name: string;
  status: "draft" | "live" | "completed" | "paused";
  startDate: string;
  endDate: string;
  coverage: string;
  kpis: string[];
  totalBudget: number;
  budgetUsed: number;
  participants: number;
  avgAttainment: number;
  aiInsights?: AIInsight[];
}

export interface PayoutTier {
  label: string;
  minAttainment: number;
  maxAttainment: number;
  payoutPerRep: number;
}

/**
 * KPI-level payout tiers — each KPI has its own attainment-based schedule.
 * The program-level `payoutTiers` is the rolled-up summary (sum across KPIs at
 * matching tier index), but truth lives at the KPI level.
 */
export interface ProgramKPI {
  name: string;
  target: string;
  weight: number;
  attainment: number;
  /** Per-KPI payout schedule (independent attainment tiers). */
  payoutTiers: PayoutTier[];
  /**
   * SKUs scoped to this KPI. Only meaningful for KPIs that require SKUs
   * (volume / sales / range / display / shelf KPIs). When omitted, falls
   * back to a sensible default split of the program's SKU list.
   */
  skus?: string[];
}

/** KPIs whose attainment is computed against specific SKUs. */
export const SKU_REQUIRING_KPIS = new Set<string>([
  "Volume",
  "Flavored Volume",
  "Juice Sales",
  "Range per Outlet",
  "Range per Listing",
  "Display Setup",
  "Shelf Compliance",
  "Active Listings",
  "Revenue",
  "Revenue Target",
  "Volume Target",
  "Premium Mix Ratio",
  "Cross-Sell Index",
  "SKUs per Outlet",
  "Depth of Distribution",
  "Share of Shelf",
  "Numeric Distribution",
  "Sales-Weighted Coverage",
  "Weighted Distribution",
  "Fill Rate",
]);

export function kpiRequiresSkus(name: string): boolean {
  return SKU_REQUIRING_KPIS.has(name);
}

export interface IncentiveProgram {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  brand: string;
  region: string;
  channel: "General Trade" | "Modern Trade" | "Wholesale" | "Horeca" | "E-Commerce";
  userType: "Sales Rep" | "Distributor" | "Merchandiser" | "Area Manager";
  startDate: string;
  endDate: string;
  kpis: ProgramKPI[];
  coverageCount: string;
  payoutMode: string;
  payoutTiers: PayoutTier[];
  badgeType: "Tiered" | "Flat" | "Milestone";
  participants: number;
  outletReach: number;
  attainmentRate: string;
  allocatedBudget: string;
  budgetUtilized: number;
  skus: string[];
  extraTags?: string[];
  roi: string;
  incrementalSales: string;
  totalPayout: string;
  kpiDisplayVariant?: "bar" | "donut";
}

export const mockPrograms: IncentiveProgram[] = [
  {
    id: "prog1",
    code: "INC_23",
    name: "Q1 Sales Incentive — North GT",
    description: "**Carbonated & juice volume** targets for **North GT** reps — **outlet billing**, **cooler compliance**.",
    icon: "📦",
    brand: "Beverages Portfolio",
    region: "North",
    channel: "General Trade",
    userType: "Sales Rep",
    startDate: "01 Apr 2026",
    endDate: "30 Jun 2026",
    kpis: [
      { name: "Volume", target: "200 cases/rep", weight: 25, attainment: 72, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1250 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 2000 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 3000 }] },
      { name: "Flavored Volume", target: "100 cases/rep", weight: 20, attainment: 68, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1000 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 1600 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 2400 }] },
      { name: "Juice Sales", target: "50 cases/rep", weight: 15, attainment: 81, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 750 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 1200 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 1800 }] },
      { name: "Outlets Covered", target: "100 outlets/rep", weight: 20, attainment: 55, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1000 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 1600 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 2400 }] },
      { name: "Cooler Compliance", target: "80% compliance", weight: 10, attainment: 62, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 500 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 800 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 1200 }] },
      { name: "Visit Compliance", target: "95% visits", weight: 10, attainment: 74, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 500 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 800 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 1200 }] },
    ],
    coverageCount: "45 Reps",
    payoutMode: "Cash",
    payoutTiers: [
      { label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 5000 },
      { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 8000 },
      { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 12000 },
    ],
    badgeType: "Tiered",
    participants: 234,
    outletReach: 890,
    attainmentRate: "67%",
    allocatedBudget: "₹15L",
    budgetUtilized: 62,
    skus: ["CC250", "CC500", "SP300", "MZ200"],
    extraTags: ["Priority", "Q1"],
    roi: "3.2x",
    incrementalSales: "₹24L",
    totalPayout: "₹7.5L",
    kpiDisplayVariant: "bar",
  },
  {
    id: "prog2",
    code: "INC_34",
    name: "Apr–May MT Plan — West",
    description: "**MT distribution & visibility** for **West** merchandisers — **numeric distribution**, **planogram compliance**, **display execution**.",
    icon: "🗺️",
    brand: "Beverages Portfolio",
    region: "West",
    channel: "Modern Trade",
    userType: "Merchandiser",
    startDate: "15 Apr 2026",
    endDate: "31 May 2026",
    kpis: [
      { name: "Store Coverage", target: "85% stores", weight: 30, attainment: 48, payoutTiers: [{ label: "Tier 1", minAttainment: 70, maxAttainment: 90, payoutPerRep: 900 }, { label: "Tier 2", minAttainment: 90, maxAttainment: 110, payoutPerRep: 1800 }, { label: "Tier 3", minAttainment: 110, maxAttainment: 140, payoutPerRep: 3000 }] },
      { name: "Sales-Weighted Coverage", target: "90% weighted coverage", weight: 20, attainment: 42, payoutTiers: [{ label: "Tier 1", minAttainment: 70, maxAttainment: 90, payoutPerRep: 600 }, { label: "Tier 2", minAttainment: 90, maxAttainment: 110, payoutPerRep: 1200 }, { label: "Tier 3", minAttainment: 110, maxAttainment: 140, payoutPerRep: 2000 }] },
      { name: "Shelf Compliance", target: "95% compliance", weight: 20, attainment: 56, payoutTiers: [{ label: "Tier 1", minAttainment: 70, maxAttainment: 90, payoutPerRep: 600 }, { label: "Tier 2", minAttainment: 90, maxAttainment: 110, payoutPerRep: 1200 }, { label: "Tier 3", minAttainment: 110, maxAttainment: 140, payoutPerRep: 2000 }] },
      { name: "Display Setup", target: "80% outlets", weight: 15, attainment: 34, payoutTiers: [{ label: "Tier 1", minAttainment: 70, maxAttainment: 90, payoutPerRep: 450 }, { label: "Tier 2", minAttainment: 90, maxAttainment: 110, payoutPerRep: 900 }, { label: "Tier 3", minAttainment: 110, maxAttainment: 140, payoutPerRep: 1500 }] },
      { name: "Cooler Compliance", target: "85% compliance", weight: 15, attainment: 51, payoutTiers: [{ label: "Tier 1", minAttainment: 70, maxAttainment: 90, payoutPerRep: 450 }, { label: "Tier 2", minAttainment: 90, maxAttainment: 110, payoutPerRep: 900 }, { label: "Tier 3", minAttainment: 110, maxAttainment: 140, payoutPerRep: 1500 }] },
    ],
    coverageCount: "38 Merchandisers",
    payoutMode: "Amazon Voucher",
    payoutTiers: [
      { label: "Tier 1", minAttainment: 70, maxAttainment: 90, payoutPerRep: 3000 },
      { label: "Tier 2", minAttainment: 90, maxAttainment: 110, payoutPerRep: 6000 },
      { label: "Tier 3", minAttainment: 110, maxAttainment: 140, payoutPerRep: 10000 },
    ],
    badgeType: "Milestone",
    participants: 156,
    outletReach: 650,
    attainmentRate: "45%",
    allocatedBudget: "₹8L",
    budgetUtilized: 45,
    skus: ["SP300", "SP500", "CC250", "FA250"],
    roi: "1.8x",
    incrementalSales: "₹14.4L",
    totalPayout: "₹8L",
    kpiDisplayVariant: "donut",
  },
  {
    id: "prog3",
    code: "INC_45",
    name: "Q1 Volume Drive — South GT",
    description: "**Carbonated volume** drive for **South GT** reps — **outlet coverage**, **new outlet acquisition**.",
    icon: "🥤",
    brand: "Carbonated Portfolio",
    region: "South",
    channel: "General Trade",
    userType: "Sales Rep",
    startDate: "01 May 2026",
    endDate: "30 Jun 2026",
    kpis: [
      { name: "Volume", target: "800 cases/rep", weight: 30, attainment: 88, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1800 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 3000 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 4500 }] },
      { name: "Juice Sales", target: "200 cases/rep", weight: 20, attainment: 82, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1200 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 2000 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 3000 }] },
      { name: "Outlets Covered", target: "50 outlets/rep", weight: 20, attainment: 91, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1200 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 2000 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 3000 }] },
      { name: "New Outlets Added", target: "5 new outlets", weight: 15, attainment: 73, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 900 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 1500 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 2250 }] },
      { name: "Visit Compliance", target: "95% visits", weight: 15, attainment: 79, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 900 }, { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 1500 }, { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 2250 }] },
    ],
    coverageCount: "52 Reps",
    payoutMode: "Cash",
    payoutTiers: [
      { label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 6000 },
      { label: "Silver", minAttainment: 100, maxAttainment: 120, payoutPerRep: 10000 },
      { label: "Gold", minAttainment: 120, maxAttainment: 150, payoutPerRep: 15000 },
    ],
    badgeType: "Tiered",
    participants: 312,
    outletReach: 1450,
    attainmentRate: "84%",
    allocatedBudget: "₹20L",
    budgetUtilized: 89,
    skus: ["CC250", "CC500", "MZ200"],
    extraTags: ["High Priority"],
    roi: "4.1x",
    incrementalSales: "₹28.7L",
    totalPayout: "₹7L",
  },
  {
    id: "prog4",
    code: "INC_56",
    name: "Q2 Horeca Incentive — East",
    description: "**Multi-SKU selling** targets for **East Horeca** reps — **outlet coverage**, **order frequency**.",
    icon: "🍽️",
    brand: "Beverages Portfolio",
    region: "East",
    channel: "Horeca",
    userType: "Sales Rep",
    startDate: "10 Apr 2026",
    endDate: "15 Jun 2026",
    kpis: [
      { name: "Volume", target: "150 cases/rep", weight: 25, attainment: 75, payoutTiers: [{ label: "Milestone 1", minAttainment: 60, maxAttainment: 80, payoutPerRep: 600 }, { label: "Milestone 2", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1250 }, { label: "Milestone 3", minAttainment: 100, maxAttainment: 130, payoutPerRep: 2250 }] },
      { name: "Juice Sales", target: "80 cases/rep", weight: 20, attainment: 70, payoutTiers: [{ label: "Milestone 1", minAttainment: 60, maxAttainment: 80, payoutPerRep: 500 }, { label: "Milestone 2", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1000 }, { label: "Milestone 3", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1800 }] },
      { name: "Range per Outlet", target: "3 SKUs/outlet", weight: 20, attainment: 78, payoutTiers: [{ label: "Milestone 1", minAttainment: 60, maxAttainment: 80, payoutPerRep: 500 }, { label: "Milestone 2", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1000 }, { label: "Milestone 3", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1800 }] },
      { name: "Outlets Covered", target: "25 outlets/rep", weight: 20, attainment: 65, payoutTiers: [{ label: "Milestone 1", minAttainment: 60, maxAttainment: 80, payoutPerRep: 500 }, { label: "Milestone 2", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1000 }, { label: "Milestone 3", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1800 }] },
      { name: "Repeat Orders", target: "2x/month/outlet", weight: 15, attainment: 68, payoutTiers: [{ label: "Milestone 1", minAttainment: 60, maxAttainment: 80, payoutPerRep: 400 }, { label: "Milestone 2", minAttainment: 80, maxAttainment: 100, payoutPerRep: 750 }, { label: "Milestone 3", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1350 }] },
    ],
    coverageCount: "29 Reps",
    payoutMode: "Flipkart Voucher",
    payoutTiers: [
      { label: "Milestone 1", minAttainment: 60, maxAttainment: 80, payoutPerRep: 2500 },
      { label: "Milestone 2", minAttainment: 80, maxAttainment: 100, payoutPerRep: 5000 },
      { label: "Milestone 3", minAttainment: 100, maxAttainment: 130, payoutPerRep: 9000 },
    ],
    badgeType: "Milestone",
    participants: 89,
    outletReach: 380,
    attainmentRate: "72%",
    allocatedBudget: "₹5L",
    budgetUtilized: 72,
    skus: ["CC250", "FA250", "MZ200", "SP300"],
    roi: "2.5x",
    incrementalSales: "₹12.5L",
    totalPayout: "₹5L",
  },
  {
    id: "prog5",
    code: "INC_67",
    name: "Festive Season Incentive — North GT",
    description: "**Festive period** push for **North GT** — **cross-category volume**, **visibility**, **compliance**.",
    icon: "🎉",
    brand: "Full Portfolio",
    region: "North",
    channel: "General Trade",
    userType: "Sales Rep",
    startDate: "01 Apr 2026",
    endDate: "31 Jul 2026",
    kpis: [
      { name: "Volume", target: "1000 cases/rep", weight: 25, attainment: 61, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1750 }, { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 3000 }, { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 4500 }] },
      { name: "Juice Sales", target: "400 cases/rep", weight: 20, attainment: 55, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1400 }, { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 2400 }, { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 3600 }] },
      { name: "Outlets Covered", target: "60 outlets/rep", weight: 15, attainment: 63, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1050 }, { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1800 }, { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 2700 }] },
      { name: "Cooler Compliance", target: "90% compliance", weight: 15, attainment: 52, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1050 }, { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1800 }, { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 2700 }] },
      { name: "Shelf Compliance", target: "85% compliance", weight: 15, attainment: 48, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 1050 }, { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1800 }, { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 2700 }] },
      { name: "Display Setup", target: "80% outlets", weight: 10, attainment: 70, payoutTiers: [{ label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 700 }, { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 1200 }, { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 1800 }] },
    ],
    coverageCount: "78 Reps",
    payoutMode: "Cash",
    payoutTiers: [
      { label: "Bronze", minAttainment: 80, maxAttainment: 100, payoutPerRep: 7000 },
      { label: "Silver", minAttainment: 100, maxAttainment: 130, payoutPerRep: 12000 },
      { label: "Gold", minAttainment: 130, maxAttainment: 160, payoutPerRep: 18000 },
    ],
    badgeType: "Tiered",
    participants: 312,
    outletReach: 1200,
    attainmentRate: "58%",
    allocatedBudget: "₹25L",
    budgetUtilized: 58,
    skus: ["CC250", "CC500", "SP300", "TU300", "MZ200", "FA250"],
    extraTags: ["Festive"],
    roi: "5.7x",
    incrementalSales: "₹85.5L",
    totalPayout: "₹15L",
  },
  {
    id: "prog6",
    code: "INC_78",
    name: "Summer MT Expansion — South",
    description: "**MT expansion** for **South** merchandisers — **new outlets**, **distribution growth**, **display compliance**.",
    icon: "🚀",
    brand: "Juice Portfolio",
    region: "South",
    channel: "Modern Trade",
    userType: "Merchandiser",
    startDate: "15 May 2026",
    endDate: "31 Jul 2026",
    kpis: [
      { name: "New Outlets Added", target: "15 new outlets", weight: 25, attainment: 42, payoutTiers: [{ label: "Flat Payout", minAttainment: 80, maxAttainment: 150, payoutPerRep: 1250 }] },
      { name: "Store Coverage", target: "70% stores", weight: 25, attainment: 38, payoutTiers: [{ label: "Flat Payout", minAttainment: 80, maxAttainment: 150, payoutPerRep: 1250 }] },
      { name: "Juice Sales", target: "300 cases", weight: 20, attainment: 45, payoutTiers: [{ label: "Flat Payout", minAttainment: 80, maxAttainment: 150, payoutPerRep: 1000 }] },
      { name: "Shelf Compliance", target: "90% compliance", weight: 15, attainment: 33, payoutTiers: [{ label: "Flat Payout", minAttainment: 80, maxAttainment: 150, payoutPerRep: 750 }] },
      { name: "Cooler Compliance", target: "80% compliance", weight: 15, attainment: 28, payoutTiers: [{ label: "Flat Payout", minAttainment: 80, maxAttainment: 150, payoutPerRep: 750 }] },
    ],
    coverageCount: "41 Merchandisers",
    payoutMode: "Bank Transfer",
    payoutTiers: [
      { label: "Flat Payout", minAttainment: 80, maxAttainment: 150, payoutPerRep: 5000 },
    ],
    badgeType: "Flat",
    participants: 156,
    outletReach: 520,
    attainmentRate: "39%",
    allocatedBudget: "₹10L",
    budgetUtilized: 39,
    skus: ["MZ200", "MZ500", "MM200"],
    roi: "2.9x",
    incrementalSales: "₹29L",
    totalPayout: "₹10L",
  },
  {
    id: "prog7",
    code: "INC_89",
    name: "Q4 Wholesale Incentive — North",
    description: "**High-volume carbonated** targets for **North wholesale** distributors — **outlet coverage** focus.",
    icon: "🏪",
    brand: "Carbonated Portfolio",
    region: "North",
    channel: "Wholesale",
    userType: "Distributor",
    startDate: "01 Mar 2026",
    endDate: "31 May 2026",
    kpis: [
      { name: "Volume", target: "5000 cases", weight: 30, attainment: 76, payoutTiers: [{ label: "Base", minAttainment: 80, maxAttainment: 100, payoutPerRep: 7500 }, { label: "Stretch", minAttainment: 100, maxAttainment: 130, payoutPerRep: 13500 }, { label: "Super Stretch", minAttainment: 130, maxAttainment: 160, payoutPerRep: 21000 }] },
      { name: "Juice Sales", target: "2000 cases", weight: 20, attainment: 71, payoutTiers: [{ label: "Base", minAttainment: 80, maxAttainment: 100, payoutPerRep: 5000 }, { label: "Stretch", minAttainment: 100, maxAttainment: 130, payoutPerRep: 9000 }, { label: "Super Stretch", minAttainment: 130, maxAttainment: 160, payoutPerRep: 14000 }] },
      { name: "Outlets Covered", target: "200 outlets", weight: 20, attainment: 82, payoutTiers: [{ label: "Base", minAttainment: 80, maxAttainment: 100, payoutPerRep: 5000 }, { label: "Stretch", minAttainment: 100, maxAttainment: 130, payoutPerRep: 9000 }, { label: "Super Stretch", minAttainment: 130, maxAttainment: 160, payoutPerRep: 14000 }] },
      { name: "Repeat Orders", target: "Weekly orders", weight: 15, attainment: 69, payoutTiers: [{ label: "Base", minAttainment: 80, maxAttainment: 100, payoutPerRep: 3750 }, { label: "Stretch", minAttainment: 100, maxAttainment: 130, payoutPerRep: 6750 }, { label: "Super Stretch", minAttainment: 130, maxAttainment: 160, payoutPerRep: 10500 }] },
      { name: "Visit Compliance", target: "90% visits", weight: 15, attainment: 65, payoutTiers: [{ label: "Base", minAttainment: 80, maxAttainment: 100, payoutPerRep: 3750 }, { label: "Stretch", minAttainment: 100, maxAttainment: 130, payoutPerRep: 6750 }, { label: "Super Stretch", minAttainment: 130, maxAttainment: 160, payoutPerRep: 10500 }] },
    ],
    coverageCount: "12 Distributors",
    payoutMode: "Bank Transfer",
    payoutTiers: [
      { label: "Base", minAttainment: 80, maxAttainment: 100, payoutPerRep: 25000 },
      { label: "Stretch", minAttainment: 100, maxAttainment: 130, payoutPerRep: 45000 },
      { label: "Super Stretch", minAttainment: 130, maxAttainment: 160, payoutPerRep: 70000 },
    ],
    badgeType: "Tiered",
    participants: 48,
    outletReach: 2400,
    attainmentRate: "74%",
    allocatedBudget: "₹30L",
    budgetUtilized: 74,
    skus: ["CC250", "CC500", "SP300", "SP500", "TU300", "FA250"],
    extraTags: ["Wholesale"],
    roi: "3.8x",
    incrementalSales: "₹45.6L",
    totalPayout: "₹12L",
  },
  {
    id: "prog8",
    code: "INC_90",
    name: "Q1 E-Commerce Plan — West",
    description: "**E-commerce** plan for **West** area managers — **listing compliance**, **digital shelf**, **revenue targets**.",
    icon: "🛒",
    brand: "Full Portfolio",
    region: "West",
    channel: "E-Commerce",
    userType: "Area Manager",
    startDate: "01 Apr 2026",
    endDate: "30 Jun 2026",
    kpis: [
      { name: "Active Listings", target: "95% listings active", weight: 25, attainment: 88, payoutTiers: [{ label: "Target Met", minAttainment: 90, maxAttainment: 110, payoutPerRep: 3750 }, { label: "Exceeded", minAttainment: 110, maxAttainment: 140, payoutPerRep: 6250 }] },
      { name: "Revenue", target: "₹10L/manager", weight: 25, attainment: 72, payoutTiers: [{ label: "Target Met", minAttainment: 90, maxAttainment: 110, payoutPerRep: 3750 }, { label: "Exceeded", minAttainment: 110, maxAttainment: 140, payoutPerRep: 6250 }] },
      { name: "Sales-Weighted Coverage", target: "85% weighted coverage", weight: 20, attainment: 65, payoutTiers: [{ label: "Target Met", minAttainment: 90, maxAttainment: 110, payoutPerRep: 3000 }, { label: "Exceeded", minAttainment: 110, maxAttainment: 140, payoutPerRep: 5000 }] },
      { name: "Range per Listing", target: "4 SKUs/listing", weight: 15, attainment: 80, payoutTiers: [{ label: "Target Met", minAttainment: 90, maxAttainment: 110, payoutPerRep: 2250 }, { label: "Exceeded", minAttainment: 110, maxAttainment: 140, payoutPerRep: 3750 }] },
      { name: "Repeat Orders", target: "Daily replenishment", weight: 15, attainment: 71, payoutTiers: [{ label: "Target Met", minAttainment: 90, maxAttainment: 110, payoutPerRep: 2250 }, { label: "Exceeded", minAttainment: 110, maxAttainment: 140, payoutPerRep: 3750 }] },
    ],
    coverageCount: "8 Area Managers",
    payoutMode: "Cash",
    payoutTiers: [
      { label: "Target Met", minAttainment: 90, maxAttainment: 110, payoutPerRep: 15000 },
      { label: "Exceeded", minAttainment: 110, maxAttainment: 140, payoutPerRep: 25000 },
    ],
    badgeType: "Tiered",
    participants: 32,
    outletReach: 180,
    attainmentRate: "76%",
    allocatedBudget: "₹12L",
    budgetUtilized: 81,
    skus: ["MM200", "MZ200", "MZ500", "LM250", "CC250"],
    roi: "2.1x",
    incrementalSales: "₹25.2L",
    totalPayout: "₹12L",
  },
];
export const mockSalesReps: SalesRep[] = [
  { id: "sr1", name: "Rahul Sharma", region: "North", territory: "Delhi NCR", outlets: 45 },
  { id: "sr2", name: "Priya Patel", region: "West", territory: "Mumbai Metro", outlets: 38 },
  { id: "sr3", name: "Amit Kumar", region: "South", territory: "Bangalore Urban", outlets: 52 },
  { id: "sr4", name: "Sneha Reddy", region: "South", territory: "Hyderabad", outlets: 41 },
  { id: "sr5", name: "Vikram Singh", region: "North", territory: "Punjab", outlets: 33 },
  { id: "sr6", name: "Ananya Das", region: "East", territory: "Kolkata", outlets: 29 },
];

export const mockProducts: Product[] = [
  // Carbonated
  { id: "p1", name: "Coca Cola", brand: "Coca Cola", category: "Carbonated", packSize: "250ml", sku: "CC250", price: 20, imageEmoji: "🥤", crossSellOpportunity: 156, distributionOpportunity: 150, salesUplift: 23800 },
  { id: "p2", name: "Coca Cola", brand: "Coca Cola", category: "Carbonated", packSize: "500ml", sku: "CC500", price: 40, imageEmoji: "🥤", crossSellOpportunity: 148, distributionOpportunity: 145, salesUplift: 31200 },
  { id: "p3", name: "Coca Cola", brand: "Coca Cola", category: "Carbonated", packSize: "1L", sku: "CC1000", price: 65, imageEmoji: "🥤", crossSellOpportunity: 110, distributionOpportunity: 125, salesUplift: 18500 },
  { id: "p4", name: "Coca Cola", brand: "Coca Cola", category: "Carbonated", packSize: "2L", sku: "CC2000", price: 95, imageEmoji: "🥤", crossSellOpportunity: 85, distributionOpportunity: 100, salesUplift: 12000 },
  { id: "p5", name: "Coca Cola Zero", brand: "Coca Cola", category: "Carbonated", packSize: "300ml", sku: "CCZ300", price: 30, imageEmoji: "🖤", crossSellOpportunity: 132, distributionOpportunity: 118, salesUplift: 21500 },
  { id: "p6", name: "Sprite", brand: "Sprite", category: "Carbonated", packSize: "300ml", sku: "SP300", price: 25, imageEmoji: "🍋", crossSellOpportunity: 142, distributionOpportunity: 156, salesUplift: 23800 },
  { id: "p7", name: "Sprite", brand: "Sprite", category: "Carbonated", packSize: "500ml", sku: "SP500", price: 40, imageEmoji: "🍋", crossSellOpportunity: 130, distributionOpportunity: 140, salesUplift: 19500 },
  { id: "p8", name: "Sprite", brand: "Sprite", category: "Carbonated", packSize: "1L", sku: "SP1000", price: 60, imageEmoji: "🍋", crossSellOpportunity: 95, distributionOpportunity: 115, salesUplift: 14200 },
  { id: "p9", name: "Fanta", brand: "Fanta", category: "Carbonated", packSize: "250ml", sku: "FA250", price: 20, imageEmoji: "🍊", crossSellOpportunity: 98, distributionOpportunity: 156, salesUplift: 23800 },
  { id: "p10", name: "Fanta", brand: "Fanta", category: "Carbonated", packSize: "100ml", sku: "FA100", price: 10, imageEmoji: "🍊", crossSellOpportunity: 120, distributionOpportunity: 156, salesUplift: 23800 },
  { id: "p11", name: "Fanta", brand: "Fanta", category: "Carbonated", packSize: "200ml", sku: "FA200", price: 15, imageEmoji: "🍊", crossSellOpportunity: 135, distributionOpportunity: 142, salesUplift: 45900 },
  { id: "p12", name: "Thums Up", brand: "Thums Up", category: "Carbonated", packSize: "300ml", sku: "TU300", price: 25, imageEmoji: "⚡", crossSellOpportunity: 160, distributionOpportunity: 140, salesUplift: 32000 },
  { id: "p13", name: "Thums Up", brand: "Thums Up", category: "Carbonated", packSize: "600ml", sku: "TU600", price: 45, imageEmoji: "⚡", crossSellOpportunity: 145, distributionOpportunity: 132, salesUplift: 28500 },
  { id: "p14", name: "Limca", brand: "Limca", category: "Carbonated", packSize: "250ml", sku: "LM250", price: 20, imageEmoji: "🍈", crossSellOpportunity: 95, distributionOpportunity: 145, salesUplift: 21000 },
  { id: "p15", name: "Limca", brand: "Limca", category: "Carbonated", packSize: "500ml", sku: "LM500", price: 35, imageEmoji: "🍈", crossSellOpportunity: 88, distributionOpportunity: 130, salesUplift: 16800 },
  { id: "p16", name: "Schweppes Tonic", brand: "Schweppes", category: "Carbonated", packSize: "300ml", sku: "SCH300", price: 45, imageEmoji: "🍸", crossSellOpportunity: 78, distributionOpportunity: 65, salesUplift: 12800 },
  // Juice
  { id: "p17", name: "Maaza", brand: "Maaza", category: "Juice", packSize: "200ml", sku: "MZ200", price: 20, imageEmoji: "🥭", crossSellOpportunity: 110, distributionOpportunity: 130, salesUplift: 18500 },
  { id: "p18", name: "Maaza", brand: "Maaza", category: "Juice", packSize: "500ml", sku: "MZ500", price: 40, imageEmoji: "🥭", crossSellOpportunity: 105, distributionOpportunity: 125, salesUplift: 16200 },
  { id: "p19", name: "Maaza", brand: "Maaza", category: "Juice", packSize: "1.2L", sku: "MZ1200", price: 75, imageEmoji: "🥭", crossSellOpportunity: 78, distributionOpportunity: 105, salesUplift: 11500 },
  { id: "p20", name: "Minute Maid", brand: "Minute Maid", category: "Juice", packSize: "200ml", sku: "MM200", price: 20, imageEmoji: "🍇", crossSellOpportunity: 75, distributionOpportunity: 120, salesUplift: 15000 },
  { id: "p21", name: "Minute Maid", brand: "Minute Maid", category: "Juice", packSize: "400ml", sku: "MM400", price: 35, imageEmoji: "🍇", crossSellOpportunity: 70, distributionOpportunity: 110, salesUplift: 12800 },
  { id: "p22", name: "Minute Maid Vitingo", brand: "Minute Maid", category: "Juice", packSize: "250ml", sku: "MMV250", price: 15, imageEmoji: "🍊", crossSellOpportunity: 92, distributionOpportunity: 135, salesUplift: 19200 },
  { id: "p23", name: "Tropico", brand: "Tropico", category: "Juice", packSize: "300ml", sku: "TR300", price: 30, imageEmoji: "🍍", crossSellOpportunity: 68, distributionOpportunity: 98, salesUplift: 9800 },
  // Tea
  { id: "p24", name: "Fuze Tea", brand: "Fuze Tea", category: "Tea", packSize: "300ml", sku: "FT300", price: 30, imageEmoji: "🍵", crossSellOpportunity: 88, distributionOpportunity: 156, salesUplift: 23800 },
  { id: "p25", name: "Fuze Tea", brand: "Fuze Tea", category: "Tea", packSize: "400ml", sku: "FT400", price: 35, imageEmoji: "🍵", crossSellOpportunity: 82, distributionOpportunity: 140, salesUplift: 20100 },
  { id: "p26", name: "Georgia Gold", brand: "Georgia", category: "Tea", packSize: "200ml", sku: "GG200", price: 20, imageEmoji: "☕", crossSellOpportunity: 65, distributionOpportunity: 88, salesUplift: 8500 },
  // Water
  { id: "p27", name: "Kinley", brand: "Kinley", category: "Water", packSize: "500ml", sku: "KN500", price: 15, imageEmoji: "💧", crossSellOpportunity: 55, distributionOpportunity: 170, salesUplift: 8200 },
  { id: "p28", name: "Kinley", brand: "Kinley", category: "Water", packSize: "1L", sku: "KN1000", price: 20, imageEmoji: "💧", crossSellOpportunity: 50, distributionOpportunity: 165, salesUplift: 7800 },
  { id: "p29", name: "Kinley", brand: "Kinley", category: "Water", packSize: "2L", sku: "KN2000", price: 30, imageEmoji: "💧", crossSellOpportunity: 42, distributionOpportunity: 155, salesUplift: 6500 },
  { id: "p30", name: "Kinley Soda", brand: "Kinley", category: "Water", packSize: "300ml", sku: "KS300", price: 15, imageEmoji: "🫧", crossSellOpportunity: 72, distributionOpportunity: 148, salesUplift: 10200 },
  { id: "p31", name: "SmartWater", brand: "SmartWater", category: "Water", packSize: "750ml", sku: "SW750", price: 50, imageEmoji: "💎", crossSellOpportunity: 60, distributionOpportunity: 72, salesUplift: 15500 },
  // Energy
  { id: "p32", name: "Monster Energy", brand: "Monster", category: "Energy", packSize: "250ml", sku: "MO250", price: 99, imageEmoji: "🔋", crossSellOpportunity: 165, distributionOpportunity: 85, salesUplift: 42000 },
  { id: "p33", name: "Monster Ultra", brand: "Monster", category: "Energy", packSize: "350ml", sku: "MOU350", price: 129, imageEmoji: "🔋", crossSellOpportunity: 155, distributionOpportunity: 78, salesUplift: 38500 },
  // Dairy
  { id: "p34", name: "Maaza Milky Delite", brand: "Maaza", category: "Dairy", packSize: "200ml", sku: "MMD200", price: 25, imageEmoji: "🥛", crossSellOpportunity: 102, distributionOpportunity: 112, salesUplift: 14500 },
  { id: "p35", name: "VIO", brand: "VIO", category: "Dairy", packSize: "180ml", sku: "VIO180", price: 20, imageEmoji: "🥛", crossSellOpportunity: 90, distributionOpportunity: 95, salesUplift: 11200 },
];

export const mockKPIs: KPI[] = [
  // Sales
  // Sales
  { id: "kpi1", name: "Revenue Target", description: "Achieve revenue target for the incentive period", category: "sales", aiReason: "3.2x ROI across 14 GT plans · 67% avg attainment · Recommended" },
  { id: "kpi2", name: "Volume Target", description: "Sell specified volume of cases/units", category: "sales", aiReason: "84% attainment in South GT last quarter · ₹24L incremental revenue" },
  { id: "kpi9", name: "SKUs per Outlet", description: "Number of different SKUs sold at each outlet", category: "sales", isAISuggested: true, aiReason: "78% cross-sell rate in similar plans · +₹1.2L incremental/quarter" },
  { id: "kpi11", name: "Average Order Value", description: "Increase average order size per outlet visit", category: "sales", aiReason: "22% lift when paired with Volume Target · 84% combined attainment" },
  { id: "kpi12", name: "Premium Mix Ratio", description: "% of premium SKUs in total volume sold", category: "sales", isAISuggested: true, aiReason: "1.8x margin vs standard mix · 67% attainment avg · High ROI lever" },
  { id: "kpi13", name: "Repeat Purchase Rate", description: "% of outlets re-ordering within 30 days", category: "sales", aiReason: "68% correlation with sustained revenue · 72% attainment in GT" },
  { id: "kpi14", name: "Cross-Sell Index", description: "Ratio of multi-category orders to total orders", category: "sales", isAISuggested: true, aiReason: "Top 20% reps hit 3.4x cross-sell · ₹2.1L/quarter avg uplift" },
  // Distribution
  { id: "kpi3", name: "Outlet Coverage", description: "Visit and bill a minimum number of outlets", category: "distribution", aiReason: "23% higher billing in covered regions · 312 reps tracked" },
  { id: "kpi4", name: "Numeric Distribution", description: "Ensure SKU availability across outlets", category: "distribution", aiReason: "48% attainment in West MT · Below 60% threshold · Set lower targets" },
  { id: "kpi5", name: "Weighted Distribution", description: "SKU availability weighted by outlet sales", category: "distribution", aiReason: "42% avg attainment across 8 plans · Complex for field reps · Caution" },
  { id: "kpi10", name: "New Outlet Acquisition", description: "Add new outlets to the coverage", category: "distribution", isAISuggested: true, aiReason: "73% attainment in South · +180 outlets added last quarter" },
  { id: "kpi15", name: "Route Efficiency", description: "Outlets visited per km traveled on beat", category: "distribution", aiReason: "15% cost reduction when optimized · ₹3.8L savings/quarter" },
  { id: "kpi16", name: "Fill Rate", description: "% of orders fulfilled completely without stockouts", category: "distribution", aiReason: "92% fill rate → 18% higher outlet retention vs 80% fill rate" },
  { id: "kpi17", name: "Depth of Distribution", description: "Average number of SKUs per stocking outlet", category: "distribution", isAISuggested: true, aiReason: "+₹1,200/outlet/month per additional SKU · 4.2 avg SKUs currently" },
  // Visibility
  { id: "kpi6", name: "Planogram Compliance", description: "Ensure shelf display matches planogram", category: "visibility", aiReason: "34% attainment historically · Only effective in MT · Use cautiously" },
  { id: "kpi7", name: "Display / POSM Placement", description: "Place display and point-of-sale materials at outlets", category: "visibility", aiReason: "12% incremental lift · Below 25% threshold · Low priority" },
  { id: "kpi18", name: "Cooler Purity", description: "% of cooler space occupied by own brands only", category: "visibility", aiReason: "62% compliance avg · 28% volume uplift in summer · Seasonal" },
  { id: "kpi19", name: "Signage Visibility", description: "Brand signage visible and maintained at outlet", category: "visibility", aiReason: "Low measurability · Requires photo audit infra · Not recommended" },
  { id: "kpi20", name: "Share of Shelf", description: "% of shelf space occupied vs competition", category: "visibility", isAISuggested: true, aiReason: "Each 5% shelf gain → 8% volume uplift · Verified across 6 MT plans" },
  // Compliance
  { id: "kpi8", name: "Order Frequency", description: "Maintain minimum order frequency per outlet", category: "compliance", aiReason: "68% attainment in Horeca · 41% in GT · Channel-dependent" },
  { id: "kpi21", name: "Beat Plan Adherence", description: "% of planned route visits actually completed", category: "compliance", aiReason: "79% avg across all channels · Reliable baseline · Recommended" },
  { id: "kpi22", name: "Photo Audit Compliance", description: "Submit geotagged photos per outlet visit", category: "compliance", aiReason: "45% improvement in data quality · Enables AI-driven insights" },
  { id: "kpi23", name: "Listing Compliance", description: "Ensure must-stock SKUs are listed at each outlet", category: "compliance", aiReason: "88% attainment in E-Commerce · 52% in GT · Channel-specific" },
  { id: "kpi24", name: "Freshness Compliance", description: "% of stock within acceptable shelf life range", category: "compliance", aiReason: "4% return rate reduction · Critical for Dairy & Juice categories" },
  { id: "kpi25", name: "MRP Compliance", description: "% of outlets selling at or below recommended price", category: "compliance", aiReason: "91% compliance in MT · 67% in GT · Protects brand pricing" },
];

export const mockLivePlans: IncentivePlan[] = [
  {
    id: "ip1", name: "Q1 Sales Incentive — North GT", status: "live", startDate: "2026-04-01", endDate: "2026-06-30", coverage: "North Region Reps", kpis: ["Cola Volume", "Outlet Billing"], totalBudget: 1500000, budgetUsed: 893600, participants: 234, avgAttainment: 67,
    aiInsights: [
      { type: "keep", text: "Cola Volume KPI drove 67% attainment — strongest performer" },
      { type: "improve", text: "Mid-tier payout missed by <5% for 41% reps — bump by ₹500" },
      { type: "drop", text: "Outlet Billing had <10% impact on results" },
    ],
  },
  {
    id: "ip2", name: "Apr–May MT Plan — West", status: "live", startDate: "2026-04-15", endDate: "2026-05-31", coverage: "West Merchandisers", kpis: ["Numeric Distribution", "Planogram Compliance"], totalBudget: 800000, budgetUsed: 532300, participants: 156, avgAttainment: 45,
    aiInsights: [
      { type: "improve", text: "Planogram Compliance targets too high — 78% reps fell short" },
      { type: "keep", text: "Numeric Distribution tracking well at 62% avg" },
      { type: "drop", text: "Display POSM added complexity with minimal ROI" },
    ],
  },
  {
    id: "ip3", name: "Q2 Horeca Incentive — East", status: "live", startDate: "2026-03-01", endDate: "2026-05-31", coverage: "East Region Reps", kpis: ["Carbonated Volume", "Outlet Billing"], totalBudget: 500000, budgetUsed: 323200, participants: 89, avgAttainment: 72,
    aiInsights: [
      { type: "keep", text: "Carbonated Volume drove 72% attainment — top KPI" },
      { type: "improve", text: "Add Juice Volume — 34% reps already cross-selling" },
      { type: "drop", text: "Outlet Billing overlaps with volume — redundant" },
    ],
  },
  {
    id: "ip4", name: "Q1 Volume Drive — South GT", status: "completed", startDate: "2026-01-01", endDate: "2026-03-31", coverage: "South Region Reps", kpis: ["Carbonated Volume", "Juice Volume"], totalBudget: 2000000, budgetUsed: 1780000, participants: 312, avgAttainment: 84,
    aiInsights: [
      { type: "keep", text: "Dual KPI (Carbonated + Juice) drove 84% — best performing plan" },
      { type: "keep", text: "3-tier payout structure maximized motivation" },
      { type: "improve", text: "Budget 89% used — increase by 10% for headroom" },
    ],
  },
];

export const regions = ["North", "South", "East", "West"];
export const channels = ["General Trade", "Modern Trade", "Wholesale", "Horeca", "E-Commerce"];
export const brands = ["Beverages Portfolio", "Carbonated Portfolio", "Juice Portfolio", "Full Portfolio"];

export const payoutModes = [
  { id: "cash", name: "Cash", icon: "💵" },
  { id: "amazon", name: "Amazon Voucher", icon: "🛒" },
  { id: "flipkart", name: "Flipkart Voucher", icon: "🛍️" },
  { id: "bank", name: "Bank Transfer", icon: "🏦" },
  { id: "wallet", name: "Digital Wallet", icon: "📱" },
];

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  prefilledConfig: {
    kpis: string[];
    payoutTiers: { min: number; max: number; amount: number }[];
    nudgeCount: number;
    estimatedROI: string;
  };
}

export interface RecommendedTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  avgAttainment: number;
  timesUsed: number;
  avgROI: string;
  prefilledConfig: {
    kpis: string[];
    payoutTiers: { min: number; max: number; amount: number }[];
    nudgeCount: number;
    coverageType: string;
  };
}

export const recommendedTemplates: RecommendedTemplate[] = [
  {
    id: "rt1",
    name: "Volume Push",
    description: "Drive volume targets for specific SKUs with tiered payouts. Best for seasonal pushes and high-demand periods.",
    icon: "📦",
    category: "Sales",
    avgAttainment: 84,
    timesUsed: 23,
    avgROI: "2.8x",
    prefilledConfig: {
      kpis: ["Volume Target", "Revenue Target"],
      payoutTiers: [
        { min: 80, max: 100, amount: 5000 },
        { min: 100, max: 120, amount: 8000 },
        { min: 120, max: 150, amount: 12000 },
      ],
      nudgeCount: 4,
      coverageType: "Regional Reps",
    },
  },
  {
    id: "rt2",
    name: "New Launch Activation",
    description: "Push new product adoption across outlets. Focus on distribution and first-order placement with milestone rewards.",
    icon: "🚀",
    category: "Launch",
    avgAttainment: 72,
    timesUsed: 15,
    avgROI: "3.2x",
    prefilledConfig: {
      kpis: ["Numeric Distribution", "New Outlet Acquisition"],
      payoutTiers: [
        { min: 70, max: 90, amount: 3000 },
        { min: 90, max: 110, amount: 6000 },
        { min: 110, max: 140, amount: 10000 },
      ],
      nudgeCount: 5,
      coverageType: "All Reps",
    },
  },
  {
    id: "rt3",
    name: "Distribution Drive",
    description: "Expand SKU availability and outlet coverage in target territories. Proven structure for geographic expansion.",
    icon: "🗺️",
    category: "Distribution",
    avgAttainment: 67,
    timesUsed: 18,
    avgROI: "2.5x",
    prefilledConfig: {
      kpis: ["Outlet Coverage", "Numeric Distribution", "Weighted Distribution"],
      payoutTiers: [
        { min: 80, max: 100, amount: 4000 },
        { min: 100, max: 120, amount: 7000 },
        { min: 120, max: 150, amount: 11000 },
      ],
      nudgeCount: 3,
      coverageType: "Territory Reps",
    },
  },
  {
    id: "rt4",
    name: "Multi-SKU Selling",
    description: "Encourage reps to sell multiple product lines at existing outlets for higher order value and category coverage.",
    icon: "🔗",
    category: "Sales",
    avgAttainment: 78,
    timesUsed: 12,
    avgROI: "3.5x",
    prefilledConfig: {
      kpis: ["SKUs per Outlet", "Revenue Target"],
      payoutTiers: [
        { min: 85, max: 100, amount: 4500 },
        { min: 100, max: 125, amount: 7500 },
        { min: 125, max: 150, amount: 12000 },
      ],
      nudgeCount: 4,
      coverageType: "Experienced Reps",
    },
  },
  {
    id: "rt5",
    name: "Festive Season Push",
    description: "Full-scale festive incentive during peak demand. Combines volume, visibility, and compliance KPIs for maximum impact.",
    icon: "🎉",
    category: "Seasonal",
    avgAttainment: 81,
    timesUsed: 8,
    avgROI: "3.0x",
    prefilledConfig: {
      kpis: ["Revenue Target", "Volume Target", "Planogram Compliance"],
      payoutTiers: [
        { min: 80, max: 100, amount: 6000 },
        { min: 100, max: 130, amount: 10000 },
        { min: 130, max: 160, amount: 15000 },
      ],
      nudgeCount: 6,
      coverageType: "All Reps",
    },
  },
  {
    id: "rt6",
    name: "Visibility & Compliance",
    description: "Incentivize planogram compliance and display / POSM placement. Ideal for brand visibility drives in Modern Trade.",
    icon: "👁️",
    category: "Visibility",
    avgAttainment: 69,
    timesUsed: 10,
    avgROI: "2.2x",
    prefilledConfig: {
      kpis: ["Planogram Compliance", "Display / POSM Placement"],
      payoutTiers: [
        { min: 80, max: 100, amount: 3500 },
        { min: 100, max: 120, amount: 6000 },
        { min: 120, max: 140, amount: 9000 },
      ],
      nudgeCount: 3,
      coverageType: "Modern Trade Reps",
    },
  },
];

export const programTemplates: ProgramTemplate[] = [
  {
    id: "t1",
    name: "Volume Push",
    description: "Drive volume targets for specific SKUs with tiered payouts. Best for seasonal pushes.",
    icon: "📦",
    category: "Sales",
    prefilledConfig: {
      kpis: ["Volume Target", "Revenue Target"],
      payoutTiers: [
        { min: 80, max: 100, amount: 5000 },
        { min: 100, max: 120, amount: 8000 },
        { min: 120, max: 150, amount: 12000 },
      ],
      nudgeCount: 4,
      estimatedROI: "2.8x",
    },
  },
  {
    id: "t2",
    name: "New Launch",
    description: "Push new product adoption across outlets. Focus on distribution and first-order placement.",
    icon: "🚀",
    category: "Launch",
    prefilledConfig: {
      kpis: ["Numeric Distribution", "New Outlet Acquisition"],
      payoutTiers: [
        { min: 70, max: 90, amount: 3000 },
        { min: 90, max: 110, amount: 6000 },
        { min: 110, max: 140, amount: 10000 },
      ],
      nudgeCount: 5,
      estimatedROI: "3.2x",
    },
  },
  {
    id: "t3",
    name: "Distribution Drive",
    description: "Expand SKU availability and outlet coverage in target territories.",
    icon: "🗺️",
    category: "Distribution",
    prefilledConfig: {
      kpis: ["Outlet Coverage", "Numeric Distribution", "Weighted Distribution"],
      payoutTiers: [
        { min: 80, max: 100, amount: 4000 },
        { min: 100, max: 120, amount: 7000 },
        { min: 120, max: 150, amount: 11000 },
      ],
      nudgeCount: 3,
      estimatedROI: "2.5x",
    },
  },
  {
    id: "t4",
    name: "Multi-SKU Selling",
    description: "Encourage reps to sell multiple product lines at existing outlets for higher order value.",
    icon: "🔗",
    category: "Sales",
    prefilledConfig: {
      kpis: ["SKUs per Outlet", "Revenue Target"],
      payoutTiers: [
        { min: 85, max: 100, amount: 4500 },
        { min: 100, max: 125, amount: 7500 },
        { min: 125, max: 150, amount: 12000 },
      ],
      nudgeCount: 4,
      estimatedROI: "3.5x",
    },
  },
  {
    id: "t5",
    name: "Festive Season Push",
    description: "Full-scale festive incentive during peak demand. Combines volume, visibility, and compliance KPIs.",
    icon: "🎉",
    category: "Seasonal",
    prefilledConfig: {
      kpis: ["Revenue Target", "Volume Target", "Planogram Compliance"],
      payoutTiers: [
        { min: 80, max: 100, amount: 6000 },
        { min: 100, max: 130, amount: 10000 },
        { min: 130, max: 160, amount: 15000 },
      ],
      nudgeCount: 6,
      estimatedROI: "3.0x",
    },
  },
];

export const aiAutoCreateExamples = [
  "Push Fanta distribution in North region for May",
  "Launch Fuze Tea in Modern Trade outlets across South",
  "Volume push for Coca Cola 250ml in Delhi NCR, budget ₹5L",
  "Multi-SKU selling for Maaza and Minute Maid in East region during summer",
  "Festive season push for all carbonated SKUs, all regions",
];

/**
 * Default split of a program's SKUs across one of its KPIs, based on KPI name.
 * Used when a KPI doesn't carry its own explicit `skus` list.
 */
export function defaultKpiSkus(kpiName: string, programSkus: string[]): string[] {
  if (!kpiRequiresSkus(kpiName)) return [];
  const products = programSkus
    .map((s) => mockProducts.find((p) => p.sku === s))
    .filter((p): p is Product => Boolean(p));

  const onlyCategory = (cat: string) => {
    const inCat = products.filter((p) => p.category === cat).map((p) => p.sku);
    return inCat.length ? inCat : programSkus;
  };

  if (kpiName === "Juice Sales") return onlyCategory("Juice");
  if (kpiName === "Volume" || kpiName === "Volume Target" || kpiName === "Flavored Volume") {
    return onlyCategory("Carbonated");
  }
  // For range / display / shelf / distribution-quality KPIs → all program SKUs.
  return programSkus;
}

/** SKUs scoped to a KPI (own list if present, else default split). */
export function getKpiSkus(kpi: ProgramKPI, program: IncentiveProgram): string[] {
  if (kpi.skus) return kpi.skus;
  return defaultKpiSkus(kpi.name, program.skus);
}

/** Union of every KPI's SKUs — the program's effective product scope. */
export function derivedProgramSkus(program: IncentiveProgram): string[] {
  const set = new Set<string>();
  program.kpis.forEach((k) => getKpiSkus(k, program).forEach((s) => set.add(s)));
  if (set.size === 0) program.skus.forEach((s) => set.add(s));
  return [...set];
}

// ============================================================================
//  EMAMI INCENTIVE PROGRAMMES (new structured model)
// ----------------------------------------------------------------------------
//  These coexist with the legacy `mockPrograms` above. Existing UI continues
//  to read `mockPrograms` (American spelling); new Emami-spec UI reads
//  `mockProgrammes` (British spelling, matching the `Programme` type).
// ============================================================================

import type {
  Programme,
  GateConditions,
  KpiConfig,
} from "@/types/programme";

export type {
  Programme,
  Channel,
  RoleType,
  WorkingSegment,
  Geography,
  ProgrammeStatus,
  DataFeedType,
  NsvBasis,
  LinearSlab,
  TieredSlab,
  FlatTriggerSlab,
  PhasingSlabs,
  EcoConfig,
  PerLineSlab,
  ChannelFocusTier,
  KpiConfig,
  GateConditions,
} from "@/types/programme";

const PERIOD = { month: 5, year: 2026, isQ1: true } as const;
const NOW = "2026-05-01T00:00:00.000Z";

const ccdMrGates: GateConditions = {
  nsvMinPct: 95,
  cftUrbanHrs: 4,
  cftRuralHrs: 3,
  cftMinWorkingDays: 17,
  cftPenaltyPct: 75,
  ecoZeroNetValueExcluded: true,
  ecoDoubleCountsSameDayBilling: true,
  partialMonthProRata: true,
};

const ccdAsoGates: GateConditions = {
  ...ccdMrGates,
  gtCollectionMinPct: 90,
};

const hcdGatesUrban: GateConditions = {
  nsvMinPct: 98,
  cftUrbanHrs: 4,
  cftRuralHrs: 0,
  cftMinWorkingDays: 17,
  cftPenaltyPct: 75,
  ecoZeroNetValueExcluded: true,
  ecoDoubleCountsSameDayBilling: true,
  partialMonthProRata: true,
};

const hcdGatesHybrid: GateConditions = {
  nsvMinPct: 98,
  cftUrbanHrs: 4,
  cftRuralHrs: 3,
  cftMinWorkingDays: 17,
  cftPenaltyPct: 75,
  ecoZeroNetValueExcluded: true,
  ecoDoubleCountsSameDayBilling: true,
  partialMonthProRata: true,
};

const hcdGatesRural: GateConditions = {
  nsvMinPct: 98,
  cftUrbanHrs: 0,
  cftRuralHrs: 3,
  cftMinWorkingDays: 17,
  cftPenaltyPct: 75,
  ecoZeroNetValueExcluded: true,
  ecoDoubleCountsSameDayBilling: true,
  partialMonthProRata: true,
};

const hcdAsoGates: GateConditions = {
  nsvMinPct: 98,
  cftUrbanHrs: 4,
  cftRuralHrs: 3,
  cftMinWorkingDays: 17,
  cftPenaltyPct: 75,
  ecoZeroNetValueExcluded: true,
  ecoDoubleCountsSameDayBilling: true,
  partialMonthProRata: true,
};

// Shared HCD MR NSV tiered slab.
const hcdMrNsvTiers: KpiConfig["tieredSlab"] = {
  tiers: [
    { thresholdPct: 98, payout: 1200, label: "98%" },
    { thresholdPct: 100, payout: 3500, label: "100%" },
    { thresholdPct: 105, payout: 5000, label: "105%" },
  ],
};

// Shared HCD ASO NSV tiered slab.
const hcdAsoNsvTiers: KpiConfig["tieredSlab"] = {
  tiers: [
    { thresholdPct: 98, payout: 5000, label: "98%" },
    { thresholdPct: 100, payout: 6000, label: "100%" },
    { thresholdPct: 105, payout: 7000, label: "105%" },
  ],
};

// Shared HCD ASM NSV tiered slab.
const hcdAsmNsvTiers: KpiConfig["tieredSlab"] = {
  tiers: [
    { thresholdPct: 98, payout: 7000, label: "98%" },
    { thresholdPct: 100, payout: 8000, label: "100%" },
    { thresholdPct: 105, payout: 9000, label: "105%" },
  ],
};

export const mockProgrammes: Programme[] = [
  // ── 1. CCD MR Urban Retail (All India) ────────────────────────────────────
  {
    id: "EMI-CCD-MR-URET",
    name: "CCD MR — Urban Retail (All India)",
    status: "active",
    channel: "CCD",
    role: "MR",
    segment: "urban-retail",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "ai-ml",
        nsvBasis: "secondary",
        linearSlab: { entryAmount: 2400, stepRate: 320, minPct: 95, capAmount: 6000 },
      },
      B_phasing: {
        enabled: true,
        dataFeed: "ai-ml",
        phasingSlab: { t55: 450, t65: 750, t70: 900, t75: 1125 },
      },
      C_eco: {
        enabled: true,
        dataFeed: "ai-ml",
        ecoConfig: { minBillValue: 250, minOutlets: 150, maxOutlets: 250, ratePerOutlet: 2, maxPayout: 500 },
      },
      D_tlsd: {
        enabled: true,
        dataFeed: "ai-ml",
        perLineSlab: { minLines: 750, maxLines: 2500, ratePerLine: 1, maxPayout: 2500 },
      },
      E_dbb: {
        enabled: true,
        dataFeed: "ai-ml",
        perLineSlab: { minLines: 25, maxLines: 300, ratePerLine: 3, maxPayout: 900 },
      },
    },
    gates: ccdMrGates,
    maxMonthlyEarning: 11025,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 2. CCD MR Urban Wholesale (All India) ─────────────────────────────────
  {
    id: "EMI-CCD-MR-UWS",
    name: "CCD MR — Urban Wholesale (All India)",
    status: "active",
    channel: "CCD",
    role: "MR",
    segment: "urban-wholesale",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "ai-ml",
        nsvBasis: "secondary",
        linearSlab: { entryAmount: 2400, stepRate: 320, minPct: 95, capAmount: 6000 },
      },
      B_phasing: {
        enabled: true,
        dataFeed: "ai-ml",
        phasingSlab: { t55: 885, t65: 1328, t70: 1770, t75: 2213 },
      },
      C_eco: {
        enabled: true,
        dataFeed: "ai-ml",
        ecoConfig: { minBillValue: 8500, minOutlets: 30, maxOutlets: 60, ratePerOutlet: 10, maxPayout: 600 },
      },
      D_tlsd: {
        enabled: true,
        dataFeed: "ai-ml",
        perLineSlab: { minLines: 100, maxLines: 300, ratePerLine: 5, maxPayout: 1500 },
      },
      E_dbb: {
        enabled: true,
        dataFeed: "ai-ml",
        perLineSlab: { minLines: 10, maxLines: 55, ratePerLine: 15, maxPayout: 825 },
      },
    },
    gates: ccdMrGates,
    maxMonthlyEarning: 11138,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 3. CCD MR Rural SS (All India) ────────────────────────────────────────
  {
    id: "EMI-CCD-MR-RSS",
    name: "CCD MR — Rural SS (All India)",
    status: "active",
    channel: "CCD",
    role: "MR",
    segment: "rural-ss",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "ai-ml",
        nsvBasis: "secondary",
        linearSlab: { entryAmount: 2400, stepRate: 320, minPct: 95, capAmount: 6000 },
      },
      B_phasing: {
        enabled: true,
        dataFeed: "ai-ml",
        phasingSlab: { t55: 885, t65: 1328, t70: 1770, t75: 2213 },
      },
      C_eco: {
        enabled: true,
        dataFeed: "ai-ml",
        ecoConfig: { minBillValue: 15000, minOutlets: 6, maxOutlets: 12, ratePerOutlet: 50, maxPayout: 600 },
      },
      D_tlsd: {
        enabled: true,
        dataFeed: "ai-ml",
        perLineSlab: { minLines: 100, maxLines: 300, ratePerLine: 5, maxPayout: 1500 },
      },
      E_dbb: {
        enabled: true,
        dataFeed: "ai-ml",
        perLineSlab: { minLines: 10, maxLines: 55, ratePerLine: 15, maxPayout: 825 },
      },
    },
    gates: ccdMrGates,
    maxMonthlyEarning: 11138,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 4. CCD MR Kerala ──────────────────────────────────────────────────────
  {
    id: "EMI-CCD-MR-KER",
    name: "CCD MR — Kerala",
    status: "active",
    channel: "CCD",
    role: "MR",
    segment: "all",
    geography: "kerala",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "ai-ml",
        nsvBasis: "primary",
        linearSlab: { entryAmount: 3960, stepRate: 528, minPct: 95, capAmount: 9900 },
      },
      B_phasing: {
        enabled: true,
        dataFeed: "ai-ml",
        phasingSlab: { t55: 390, t65: 585, t70: 780, t75: 975 },
      },
      C_eco: { enabled: false, dataFeed: "ai-ml" },
      D_tlsd: { enabled: false, dataFeed: "ai-ml" },
      E_dbb: { enabled: false, dataFeed: "ai-ml" },
      L_quarterly: {
        enabled: true,
        dataFeed: "ai-ml",
        linearSlab: { entryAmount: 2400, stepRate: 320, minPct: 95, capAmount: 6000 },
      },
    },
    gates: ccdMrGates,
    maxMonthlyEarning: 10875,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 5. CCD ASO/ASE All India ──────────────────────────────────────────────
  {
    id: "EMI-CCD-ASO-AI",
    name: "CCD ASO/ASE — All India",
    status: "active",
    channel: "CCD",
    role: "ASO_ASE",
    segment: "all",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "ai-ml",
        nsvBasis: "secondary",
        linearSlab: { entryAmount: 2700, stepRate: 360, minPct: 95, capAmount: 6750 },
      },
      B_phasing: {
        enabled: true,
        dataFeed: "ai-ml",
        phasingSlab: { t55: 900, t65: 1350, t70: 1800, t75: 2250 },
      },
      C_eco: { enabled: true, dataFeed: "proxy", payoutAmount: 1800 },
      D_tlsd: { enabled: true, dataFeed: "proxy", payoutAmount: 1800 },
      E_dbb: { enabled: true, dataFeed: "proxy", payoutAmount: 1800 },
      // Two quarterly slabs (GT + Region). We store GT here; Region is a
      // secondary derivation captured via `payoutAmount` (max region cap).
      L_quarterly: {
        enabled: true,
        dataFeed: "ai-ml",
        linearSlab: { entryAmount: 5760, stepRate: 768, minPct: 95, capAmount: 14400 },
        payoutAmount: 7200, // Region slab cap (entry 2880, step 384, cap 7200)
      },
    },
    gates: ccdAsoGates,
    maxMonthlyEarning: 14400,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 6. CCD ASO/ASE Kerala ─────────────────────────────────────────────────
  {
    id: "EMI-CCD-ASO-KER",
    name: "CCD ASO/ASE — Kerala",
    status: "active",
    channel: "CCD",
    role: "ASO_ASE",
    segment: "all",
    geography: "kerala",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "ai-ml",
        nsvBasis: "primary",
        linearSlab: { entryAmount: 5760, stepRate: 768, minPct: 95, capAmount: 14400 },
      },
      B_phasing: {
        enabled: true,
        dataFeed: "ai-ml",
        phasingSlab: { t55: 1200, t65: 1800, t70: 2400, t75: 3000 },
      },
      L_quarterly: {
        enabled: true,
        dataFeed: "ai-ml",
        linearSlab: { entryAmount: 5760, stepRate: 768, minPct: 95, capAmount: 14400 },
        payoutAmount: 7200,
      },
    },
    gates: ccdAsoGates,
    maxMonthlyEarning: 14400,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 7. HCD MR Urban ───────────────────────────────────────────────────────
  {
    id: "EMI-HCD-MR-URB",
    name: "HCD MR — Urban",
    status: "active",
    channel: "HCD",
    role: "MR",
    segment: "urban",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "secondary",
        tieredSlab: hcdMrNsvTiers,
      },
      D_tlsd: {
        enabled: true,
        dataFeed: "mdm-upload",
        tieredSlab: {
          tiers: [
            { thresholdPct: 100, payout: 800, label: "100%" },
            { thresholdPct: 105, payout: 1500, label: "105%" },
          ],
        },
      },
      C_eco: {
        enabled: true,
        dataFeed: "mdm-upload",
        tieredSlab: {
          tiers: [
            { thresholdPct: 100, payout: 800, label: "100%" },
            { thresholdPct: 105, payout: 1500, label: "105%" },
          ],
        },
      },
      F_cft: { enabled: true, dataFeed: "manual", urbanHrsThreshold: 4 },
    },
    gates: hcdGatesUrban,
    maxMonthlyEarning: 8000,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 8. HCD MR Hybrid ──────────────────────────────────────────────────────
  {
    id: "EMI-HCD-MR-HYB",
    name: "HCD MR — Hybrid",
    status: "draft",
    channel: "HCD",
    role: "MR",
    segment: "hybrid",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "secondary",
        tieredSlab: hcdMrNsvTiers,
      },
      D_tlsd: {
        enabled: true,
        dataFeed: "mdm-upload",
        tieredSlab: {
          tiers: [
            { thresholdPct: 100, payout: 750, label: "100% (urban DB)" },
            { thresholdPct: 105, payout: 1000, label: "105% (urban DB)" },
          ],
        },
      },
      C_eco: {
        enabled: true,
        dataFeed: "mdm-upload",
        tieredSlab: {
          tiers: [
            { thresholdPct: 100, payout: 750, label: "100% (urban DB)" },
            { thresholdPct: 105, payout: 1000, label: "105% (urban DB)" },
          ],
        },
      },
      G_subDbBilling: {
        enabled: true,
        dataFeed: "mdm-upload",
        flatTrigger: { thresholdPct: 80, payout: 1000 },
      },
      F_cft: {
        enabled: true,
        dataFeed: "manual",
        urbanHrsThreshold: 4,
        ruralHrsThreshold: 3,
      },
    },
    gates: hcdGatesHybrid,
    maxMonthlyEarning: 8000,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 9. HCD MR Rural ───────────────────────────────────────────────────────
  {
    id: "EMI-HCD-MR-RUR",
    name: "HCD MR — Rural",
    status: "active",
    channel: "HCD",
    role: "MR",
    segment: "rural",
    geography: "all-india",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "sub-db-primary",
        tieredSlab: hcdMrNsvTiers,
      },
      G_subDbBilling: {
        enabled: true,
        dataFeed: "mdm-upload",
        flatTrigger: { thresholdPct: 80, payout: 1500 },
      },
      H_msb: {
        enabled: true,
        dataFeed: "mdm-upload",
        // Threshold here represents "min brands billed", not a percentage.
        flatTrigger: { thresholdPct: 3, payout: 1500 },
      },
      F_cft: { enabled: true, dataFeed: "manual", ruralHrsThreshold: 3 },
    },
    gates: hcdGatesRural,
    maxMonthlyEarning: 8000,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 10. HCD ASO Urban (Del/Mum/Kol) ───────────────────────────────────────
  {
    id: "EMI-HCD-ASO-URB",
    name: "HCD ASO — Urban (Del/Mum/Kol)",
    status: "draft",
    channel: "HCD",
    role: "ASO",
    segment: "urban-cities",
    geography: "urban-cities",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "secondary",
        tieredSlab: hcdAsoNsvTiers,
      },
      I_channelFocus: {
        enabled: true,
        dataFeed: "mdm-upload",
        channelFocusTiers: [
          { channelName: "Grocer", t90: 1000, t95: 1500, t100: 2000, ecoWeight: 50, salesWeight: 50, timing: "may-jun" },
          { channelName: "SAMT", t90: 1000, t95: 1500, t100: 2000, ecoWeight: 50, salesWeight: 50, timing: "may-jun" },
          { channelName: "WS", t90: 0, t95: 0, t100: 1000, ecoWeight: 0, salesWeight: 100, timing: "monthly" },
        ],
      },
      J_teamEarning: {
        enabled: true,
        dataFeed: "mdm-upload",
        budgetedCount: 5,
        payoutAmount: 4000,
      },
      K_appUsage: {
        enabled: true,
        dataFeed: "manual",
        urbanHrsThreshold: 4,
        ruralHrsThreshold: 3,
        payoutAmount: 1000,
      },
    },
    gates: hcdAsoGates,
    maxMonthlyEarning: 12000,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 11. HCD ASO Other ─────────────────────────────────────────────────────
  {
    id: "EMI-HCD-ASO-OTH",
    name: "HCD ASO — Other Markets",
    status: "archived",
    channel: "HCD",
    role: "ASO",
    segment: "other-markets",
    geography: "other-markets",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "secondary",
        tieredSlab: hcdAsoNsvTiers,
      },
      I_channelFocus: {
        enabled: true,
        dataFeed: "mdm-upload",
        channelFocusTiers: [
          { channelName: "Grocer + SAMT", t90: 1000, t95: 1500, t100: 2000, ecoWeight: 50, salesWeight: 50, timing: "may-jun" },
          { channelName: "Rural MSB", t90: 0, t95: 0, t100: 1000, ecoWeight: 0, salesWeight: 100, timing: "monthly" },
          { channelName: "WS", t90: 0, t95: 0, t100: 1000, ecoWeight: 0, salesWeight: 100, timing: "monthly" },
        ],
      },
      J_teamEarning: {
        enabled: true,
        dataFeed: "mdm-upload",
        budgetedCount: 5,
        payoutAmount: 4000,
      },
      K_appUsage: {
        enabled: true,
        dataFeed: "manual",
        urbanHrsThreshold: 4,
        ruralHrsThreshold: 3,
        payoutAmount: 1000,
      },
    },
    gates: hcdAsoGates,
    maxMonthlyEarning: 13000,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 12. HCD ASM Urban (Del/Mum) ───────────────────────────────────────────
  {
    id: "EMI-HCD-ASM-URB",
    name: "HCD ASM — Urban (Del/Mum)",
    status: "active",
    channel: "HCD",
    role: "ASM",
    segment: "urban-cities",
    geography: "urban-cities",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "primary",
        tieredSlab: hcdAsmNsvTiers,
      },
      I_channelFocus: {
        enabled: true,
        dataFeed: "mdm-upload",
        channelFocusTiers: [
          { channelName: "Grocer", t90: 2000, t95: 2500, t100: 3000, ecoWeight: 50, salesWeight: 50, timing: "after-jun" },
          { channelName: "SAMT", t90: 1000, t95: 1500, t100: 2000, ecoWeight: 50, salesWeight: 50, timing: "after-jun" },
          { channelName: "WS", t90: 0, t95: 0, t100: 1500, ecoWeight: 0, salesWeight: 100, timing: "monthly" },
        ],
      },
      J_teamEarning: {
        enabled: true,
        dataFeed: "mdm-upload",
        budgetedCount: 5,
        payoutAmount: 4000,
      },
    },
    gates: hcdAsoGates,
    maxMonthlyEarning: 14500,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ── 13. HCD ASM Other ─────────────────────────────────────────────────────
  {
    id: "EMI-HCD-ASM-OTH",
    name: "HCD ASM — Other Markets",
    status: "archived",
    channel: "HCD",
    role: "ASM",
    segment: "other-markets",
    geography: "other-markets",
    period: { ...PERIOD },
    kpis: {
      A_nsv: {
        enabled: true,
        dataFeed: "mdm-upload",
        nsvBasis: "primary",
        tieredSlab: hcdAsmNsvTiers,
      },
      I_channelFocus: {
        enabled: true,
        dataFeed: "mdm-upload",
        channelFocusTiers: [
          { channelName: "Grocer + SAMT", t90: 1000, t95: 1500, t100: 2000, ecoWeight: 50, salesWeight: 50, timing: "after-jun" },
          { channelName: "Rural MSB", t90: 0, t95: 0, t100: 1000, ecoWeight: 0, salesWeight: 100, timing: "monthly" },
          { channelName: "WS", t90: 0, t95: 0, t100: 1000, ecoWeight: 0, salesWeight: 100, timing: "monthly" },
        ],
      },
      J_teamEarning: {
        enabled: true,
        dataFeed: "mdm-upload",
        budgetedCount: 5,
        payoutAmount: 4000,
      },
    },
    gates: hcdAsoGates,
    maxMonthlyEarning: 15000,
    createdAt: NOW,
    updatedAt: NOW,
  },
];
