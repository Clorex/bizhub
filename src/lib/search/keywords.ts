// FILE: src/lib/search/keywords.ts
import { MARKET_CATEGORIES, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";

function normText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function prefixes(word: string) {
  const out: string[] = [];
  const w = String(word || "").trim();
  for (let i = 2; i <= Math.min(10, w.length); i++) out.push(w.slice(0, i));
  return out;
}

function splitWords(s: string) {
  const t = normText(s);
  if (!t) return [];
  return t.split(" ").filter(Boolean).slice(0, 60);
}

export function cleanListCsv(input: any): string[] {
  const s = String(input || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => normText(x))
    .filter(Boolean)
    .slice(0, 20);
}

function uniq<T>(arr: T[]) {
  const out: T[] = [];
  const seen = new Set<any>();
  for (const x of arr) {
    const k = String(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export function keywordsForProduct(args: {
  name: string;
  description?: string;
  categoryKeys?: MarketCategoryKey[] | null;
  colors?: string[];
  sizes?: string[];
}) {
  const out = new Set<string>();

  const nameWords = splitWords(args.name);
  const descWords = splitWords(args.description || "");

  for (const w of [...nameWords, ...descWords]) {
    out.add(w);
    for (const p of prefixes(w)) out.add(p);
  }

  const catKeys = uniq(Array.isArray(args.categoryKeys) ? args.categoryKeys : []).slice(0, 3);
  for (const ck of catKeys) {
    out.add(ck);
    const cat = MARKET_CATEGORIES.find((c) => c.key === ck);
    for (const s of cat?.synonyms || []) out.add(s);
  }

  for (const c of (args.colors || []).map((x) => normText(x)).filter(Boolean)) out.add(c);
  for (const s of (args.sizes || []).map((x) => normText(x)).filter(Boolean)) out.add(s);

  return Array.from(out).slice(0, 180);
}

export function keywordsForBusiness(args: {
  slug?: string;
  name?: string;
  description?: string;
  state?: string;
  city?: string;
  instagram?: string;
  tags?: string[];
}) {
  const out = new Set<string>();

  const text = [
    args.slug,
    args.name,
    args.description,
    args.state,
    args.city,
    args.instagram,
    ...(Array.isArray(args.tags) ? args.tags : []),
  ]
    .map((x) => String(x || ""))
    .join(" ");

  const words = splitWords(text);
  for (const w of words) {
    out.add(w);
    for (const p of prefixes(w)) out.add(p);
  }

  return Array.from(out).slice(0, 180);
}