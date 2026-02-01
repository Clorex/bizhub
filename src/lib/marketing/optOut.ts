// FILE: src/lib/marketing/optOut.ts
export type OptOutPrefs = {
  globalOptOut: boolean;
  storeOptOutSlugs: string[];
  updatedAtMs: number;
};

const KEY = "bizhub_marketing_optout_v1";

function safeParse(raw: string | null): OptOutPrefs | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;

    const globalOptOut = !!v.globalOptOut;
    const storeOptOutSlugs = Array.isArray(v.storeOptOutSlugs)
      ? v.storeOptOutSlugs.map(String).filter(Boolean).slice(0, 500)
      : [];

    const updatedAtMs = Number(v.updatedAtMs || 0);

    return { globalOptOut, storeOptOutSlugs, updatedAtMs };
  } catch {
    return null;
  }
}

export function loadOptOutPrefs(): OptOutPrefs {
  if (typeof window === "undefined") return { globalOptOut: false, storeOptOutSlugs: [], updatedAtMs: 0 };
  return safeParse(localStorage.getItem(KEY)) || { globalOptOut: false, storeOptOutSlugs: [], updatedAtMs: 0 };
}

export function saveOptOutPrefs(p: OptOutPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}