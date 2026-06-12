// Mock FMCG product catalog used by the DBB cascading product selector.
// Hierarchy: Category → Brand → Pack size → SKU code

export interface SkuNode {
  code: string;          // SKU code
  name: string;          // SKU description
  groupCode: string;     // CRS / group code
  image: string;         // SKU pack-shot URL
}
export interface PackNode {
  packSize: string;
  skus: SkuNode[];
}
export interface BrandNode {
  brand: string;
  packs: PackNode[];
  /** Optional brand color used for tinted thumbnails / chips */
  color?: string;
}
export interface CategoryNode {
  category: string;
  brands: BrandNode[];
  /** Emoji used as a quick visual cue when no image is available */
  emoji?: string;
}

// Deterministic, network-free pack shot. Generates a soft gradient tile
// with the product initials — looks clean and won't break offline.
function packShot(seed: string, label: string, tint: string): string {
  const initials = label
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g-${seed}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${tint}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${tint}" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="s-${seed}" cx="0.3" cy="0.25" r="0.8">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#g-${seed})"/>
  <rect width="200" height="200" rx="20" fill="url(#s-${seed})"/>
  <text x="100" y="118" text-anchor="middle"
        font-family="Inter, system-ui, sans-serif"
        font-size="68" font-weight="700" fill="#ffffff"
        opacity="0.95" letter-spacing="-2">${initials}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const TINT = {
  cg: "#d97706", // amber – Crunchy Gold
  mb: "#a16207", // dark amber – MorningBite
  fp: "#dc2626", // red – FizzPop
  ps: "#ea580c", // orange – PureSip
  sg: "#7c3aed", // violet – SilkGlow
  fd: "#0d9488", // teal – FreshDay
};

export const PRODUCT_CATALOG: CategoryNode[] = [
  {
    category: "Biscuits",
    emoji: "🍪",
    brands: [
      {
        brand: "Crunchy Gold",
        color: TINT.cg,
        packs: [
          {
            packSize: "50 g",
            skus: [
              { code: "BIS-CG-050-01", name: "Crunchy Gold Classic 50g", groupCode: "CG-CLASSIC", image: packShot("cg501", "CG Classic", TINT.cg) },
              { code: "BIS-CG-050-02", name: "Crunchy Gold Choco 50g",   groupCode: "CG-CHOCO",   image: packShot("cg502", "CG Choco",   TINT.cg) },
            ],
          },
          {
            packSize: "120 g",
            skus: [
              { code: "BIS-CG-120-01", name: "Crunchy Gold Classic 120g", groupCode: "CG-CLASSIC", image: packShot("cg1201", "CG Classic", TINT.cg) },
              { code: "BIS-CG-120-02", name: "Crunchy Gold Choco 120g",   groupCode: "CG-CHOCO",   image: packShot("cg1202", "CG Choco",   TINT.cg) },
            ],
          },
        ],
      },
      {
        brand: "MorningBite",
        color: TINT.mb,
        packs: [
          {
            packSize: "75 g",
            skus: [
              { code: "BIS-MB-075-01", name: "MorningBite Marie 75g",     groupCode: "MB-MARIE",   image: packShot("mb751", "MB Marie",   TINT.mb) },
              { code: "BIS-MB-075-02", name: "MorningBite Glucose 75g",   groupCode: "MB-GLUCOSE", image: packShot("mb752", "MB Glucose", TINT.mb) },
            ],
          },
          {
            packSize: "200 g",
            skus: [
              { code: "BIS-MB-200-01", name: "MorningBite Marie 200g",    groupCode: "MB-MARIE",   image: packShot("mb2001", "MB Marie", TINT.mb) },
            ],
          },
        ],
      },
    ],
  },
  {
    category: "Beverages",
    emoji: "🥤",
    brands: [
      {
        brand: "FizzPop",
        color: TINT.fp,
        packs: [
          {
            packSize: "250 ml",
            skus: [
              { code: "BEV-FP-250-01", name: "FizzPop Cola 250ml",       groupCode: "FP-COLA",   image: packShot("fp2501", "FP Cola",   TINT.fp) },
              { code: "BEV-FP-250-02", name: "FizzPop Orange 250ml",     groupCode: "FP-ORANGE", image: packShot("fp2502", "FP Orange", TINT.fp) },
            ],
          },
          {
            packSize: "600 ml",
            skus: [
              { code: "BEV-FP-600-01", name: "FizzPop Cola 600ml",       groupCode: "FP-COLA",   image: packShot("fp6001", "FP Cola",  TINT.fp) },
              { code: "BEV-FP-600-02", name: "FizzPop Lemon 600ml",      groupCode: "FP-LEMON",  image: packShot("fp6002", "FP Lemon", TINT.fp) },
            ],
          },
        ],
      },
      {
        brand: "PureSip Juice",
        color: TINT.ps,
        packs: [
          {
            packSize: "200 ml",
            skus: [
              { code: "BEV-PS-200-01", name: "PureSip Mango 200ml",      groupCode: "PS-MANGO", image: packShot("ps2001", "PS Mango", TINT.ps) },
              { code: "BEV-PS-200-02", name: "PureSip Mixed Fruit 200ml", groupCode: "PS-MIX",  image: packShot("ps2002", "PS Mix",   TINT.ps) },
            ],
          },
          {
            packSize: "1 L",
            skus: [
              { code: "BEV-PS-1000-01", name: "PureSip Mango 1L",        groupCode: "PS-MANGO", image: packShot("ps10001", "PS Mango", TINT.ps) },
            ],
          },
        ],
      },
    ],
  },
  {
    category: "Personal Care",
    emoji: "🧴",
    brands: [
      {
        brand: "SilkGlow",
        color: TINT.sg,
        packs: [
          {
            packSize: "100 ml",
            skus: [
              { code: "PC-SG-100-01", name: "SilkGlow Shampoo 100ml",    groupCode: "SG-SHAMPOO", image: packShot("sg1001", "SG Shampoo", TINT.sg) },
              { code: "PC-SG-100-02", name: "SilkGlow Conditioner 100ml", groupCode: "SG-COND",   image: packShot("sg1002", "SG Cond",    TINT.sg) },
            ],
          },
          {
            packSize: "5 ml sachet",
            skus: [
              { code: "PC-SG-005-01", name: "SilkGlow Shampoo Sachet",   groupCode: "SG-SHAMPOO", image: packShot("sg0051", "SG Sachet", TINT.sg) },
            ],
          },
        ],
      },
      {
        brand: "FreshDay",
        color: TINT.fd,
        packs: [
          {
            packSize: "75 g",
            skus: [
              { code: "PC-FD-075-01", name: "FreshDay Toothpaste 75g",   groupCode: "FD-TP", image: packShot("fd751", "FD Paste", TINT.fd) },
            ],
          },
          {
            packSize: "150 g",
            skus: [
              { code: "PC-FD-150-01", name: "FreshDay Toothpaste 150g",  groupCode: "FD-TP", image: packShot("fd1501", "FD Paste", TINT.fd) },
            ],
          },
        ],
      },
    ],
  },
];

export type ProductSelectionLevel = "category" | "brand" | "pack" | "sku";

export interface ProductSelection {
  // Each entry encodes selection at one level. e.g. { level: "brand", category: "Biscuits", brand: "Crunchy Gold" }
  id: string;
  level: ProductSelectionLevel;
  category: string;
  brand?: string;
  packSize?: string;
  skuCode?: string;
  /** SKU codes to exclude from a broad (category/brand/pack) selection */
  excludedSkuCodes?: string[];
}

export function describeSelection(s: ProductSelection): string {
  const parts = [s.category];
  if (s.brand) parts.push(s.brand);
  if (s.packSize) parts.push(s.packSize);
  if (s.skuCode) parts.push(s.skuCode);
  return parts.join(" › ");
}

/** All SKUs covered by a selection BEFORE exclusions are applied */
export function getAllSkusInSelection(s: ProductSelection): SkuNode[] {
  const cat = PRODUCT_CATALOG.find((c) => c.category === s.category);
  if (!cat) return [];
  if (s.level === "category") return cat.brands.flatMap((b) => b.packs.flatMap((p) => p.skus));
  const brand = cat.brands.find((b) => b.brand === s.brand);
  if (!brand) return [];
  if (s.level === "brand") return brand.packs.flatMap((p) => p.skus);
  const pack = brand.packs.find((p) => p.packSize === s.packSize);
  if (!pack) return [];
  if (s.level === "pack") return pack.skus;
  return pack.skus.filter((sk) => sk.code === s.skuCode);
}

/** SKUs covered AFTER exclusions are applied */
export function getEffectiveSkusInSelection(s: ProductSelection): SkuNode[] {
  const all = getAllSkusInSelection(s);
  if (!s.excludedSkuCodes?.length) return all;
  const ex = new Set(s.excludedSkuCodes);
  return all.filter((sk) => !ex.has(sk.code));
}

export function countSkusInSelection(s: ProductSelection): number {
  return getEffectiveSkusInSelection(s).length;
}

/** Up to N representative pack shots for a selection — used for thumbnail strips */
export function previewImagesForSelection(s: ProductSelection, max = 4): string[] {
  return getEffectiveSkusInSelection(s).slice(0, max).map((sk) => sk.image);
}
