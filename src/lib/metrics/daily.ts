import { adminDb } from "@/lib/firebase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKeyFromMs(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function startOfDayMs(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayKeysBetween(startMs: number, endMs: number) {
  const out: string[] = [];
  let t = startOfDayMs(startMs);
  const end = startOfDayMs(endMs);

  // Nigeria/no DST issues; safe enough for MVP
  while (t <= end) {
    out.push(dayKeyFromMs(t));
    t += DAY_MS;
  }
  return out;
}

export function monthRangeFromYYYYMM(yyyyMm: string) {
  // yyyy-mm
  const [yStr, mStr] = yyyyMm.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;

  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime() - 1; // last ms of month
  return { startMs: start, endMs: end };
}

export async function fetchBusinessDailyMetrics(params: {
  businessId: string;
  dayKeys: string[];
}) {
  const { businessId, dayKeys } = params;

  if (!dayKeys.length) return [];

  const refs = dayKeys.map((dk) =>
    adminDb.collection("businessMetricsDaily").doc(`${businessId}_${dk}`)
  );

  // Firestore Admin supports getAll
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snaps: any[] = await (adminDb as any).getAll(...refs);

  return snaps.map((s) => (s.exists ? ({ id: s.id, ...(s.data() as any) }) : null)).filter(Boolean);
}

export async function fetchPlatformDailyMetrics(dayKeys: string[]) {
  if (!dayKeys.length) return [];

  const refs = dayKeys.map((dk) => adminDb.collection("platformMetricsDaily").doc(dk));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snaps: any[] = await (adminDb as any).getAll(...refs);

  return snaps.map((s) => (s.exists ? ({ id: s.id, ...(s.data() as any) }) : null)).filter(Boolean);
}