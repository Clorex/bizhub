// FILE: src/lib/products/coverAspect.ts
export type CoverAspectKey = "1:1" | "4:5" | "5:7" | "3:4" | "2:3" | "16:9" | "9:16";

export const COVER_ASPECT_OPTIONS: { key: CoverAspectKey; label: string; w: number; h: number }[] = [
  { key: "1:1", label: "1:1 (Square)", w: 1, h: 1 },
  { key: "4:5", label: "4:5 (Portrait)", w: 4, h: 5 },
  { key: "5:7", label: "5:7 (Portrait)", w: 5, h: 7 },
  { key: "3:4", label: "3:4 (Portrait)", w: 3, h: 4 },
  { key: "2:3", label: "2:3 (Portrait)", w: 2, h: 3 },
  { key: "16:9", label: "16:9 (Landscape)", w: 16, h: 9 },
  { key: "9:16", label: "9:16 (Story)", w: 9, h: 16 },
];

export function normalizeCoverAspect(v: any): CoverAspectKey | null {
  const s = String(v || "").trim();
  return COVER_ASPECT_OPTIONS.some((x) => x.key === s) ? (s as CoverAspectKey) : null;
}

/** ✅ static map so Tailwind never drops these utilities */
export const COVER_ASPECT_CLASS: Record<CoverAspectKey, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "5:7": "aspect-[5/7]",
  "3:4": "aspect-[3/4]",
  "2:3": "aspect-[2/3]",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
};

export function coverAspectToTailwindClass(k: CoverAspectKey) {
  return COVER_ASPECT_CLASS[k] || "aspect-square";
}

export function coverAspectToWH(k: CoverAspectKey, baseW: number) {
  const opt = COVER_ASPECT_OPTIONS.find((x) => x.key === k) || COVER_ASPECT_OPTIONS[0];
  const w = Math.max(10, Math.floor(Number(baseW || 0)));
  const h = Math.max(10, Math.floor((w * opt.h) / opt.w));
  return { w, h };
}