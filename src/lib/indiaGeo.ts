// India state geometry + projection.
// The raw file is a quantised district mesh grouped by state: `p` holds the
// filled polygons, `b` holds only the segments that form the state outline
// (interior district edges are dropped), so states render as solid shapes.

import raw from "@/data/indiaStates.json";

interface RawState {
  n: string;
  p: number[][][];
  b: number[][][];
}

const states = raw as RawState[];

export const VIEW_W = 760;
export const VIEW_H = 820;

// Equirectangular with a cosine correction at India's mid-latitude — close
// enough to a conic at this scale and cheap to invert.
const LAT0 = (23 * Math.PI) / 180;
const KX = Math.cos(LAT0);

function projectRaw(lon: number, lat: number): [number, number] {
  return [lon * KX, -lat];
}

const bounds = (() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of states) {
    for (const ring of s.p) {
      for (const [lon, lat] of ring) {
        const [x, y] = projectRaw(lon, lat);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
})();

const PAD = 12;
const scale = Math.min(
  (VIEW_W - PAD * 2) / (bounds.maxX - bounds.minX),
  (VIEW_H - PAD * 2) / (bounds.maxY - bounds.minY),
);
const offX = PAD + (VIEW_W - PAD * 2 - (bounds.maxX - bounds.minX) * scale) / 2;
const offY = PAD + (VIEW_H - PAD * 2 - (bounds.maxY - bounds.minY) * scale) / 2;

function project(lon: number, lat: number): [number, number] {
  const [x, y] = projectRaw(lon, lat);
  return [(x - bounds.minX) * scale + offX, (y - bounds.minY) * scale + offY];
}

export interface StateShape {
  name: string;
  /** Filled area (all district polygons of the state). */
  fill: string;
  /** State outline only. */
  outline: string;
  /** Label anchor — centroid of the largest polygon. */
  cx: number;
  cy: number;
}

function ringArea(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  return Math.abs(a / 2);
}

export const stateShapes: StateShape[] = states.map((s) => {
  let fill = "";
  let best = { area: -1, cx: 0, cy: 0 };
  for (const ring of s.p) {
    const pts = ring.map(([lon, lat]) => project(lon, lat));
    fill += "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
    const a = ringArea(pts);
    if (a > best.area) {
      const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length;
      const cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
      best = { area: a, cx, cy };
    }
  }
  let outline = "";
  for (const seg of s.b) {
    const [a, b] = seg.map(([lon, lat]) => project(lon, lat));
    outline += `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  return { name: s.n, fill, outline, cx: best.cx, cy: best.cy };
});

export const STATE_NAMES = stateShapes.map((s) => s.name);

/** Sales regions used across the incentive estate. */
export const STATE_REGION: Record<string, string> = {
  "Jammu and Kashmir": "North", Ladakh: "North", "Himachal Pradesh": "North",
  Punjab: "North", Chandigarh: "North", Uttarakhand: "North", Haryana: "North",
  Delhi: "North", "Uttar Pradesh": "North", Rajasthan: "North",

  Gujarat: "West", Maharashtra: "West", Goa: "West",
  "Dadra and Nagar Haveli and Daman and Diu": "West",

  "Madhya Pradesh": "Central", Chhattisgarh: "Central",

  Bihar: "East", Jharkhand: "East", "West Bengal": "East", Odisha: "East",
  Sikkim: "East", Assam: "East", Meghalaya: "East", Tripura: "East",
  Manipur: "East", Mizoram: "East", Nagaland: "East", "Arunachal Pradesh": "East",

  Karnataka: "South", Kerala: "South", "Tamil Nadu": "South",
  "Andhra Pradesh": "South", Telangana: "South", Puducherry: "South",
  "Andaman and Nicobar Islands": "South", Lakshadweep: "South",
};

/** States grouped by region, in a stable order. */
export const REGION_STATES: Record<string, string[]> = STATE_NAMES.reduce(
  (acc, name) => {
    const r = STATE_REGION[name] ?? "Central";
    (acc[r] ||= []).push(name);
    return acc;
  },
  {} as Record<string, string[]>,
);
