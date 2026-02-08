// FILE: src/lib/market/filters/facets.ts

function norm(s: any) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function topByCount(map: Map<string, number>, max = 16) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k)
    .slice(0, max);
}

export function buildFashionFacets(products: any[]) {
  const colors = new Map<string, number>();
  const sizes = new Map<string, number>();

  for (const p of products || []) {
    const c = Array.isArray(p?.attrs?.colors) ? p.attrs.colors : [];
    const s = Array.isArray(p?.attrs?.sizes) ? p.attrs.sizes : [];

    for (const x of c) {
      const k = norm(x);
      if (!k) continue;
      colors.set(k, (colors.get(k) || 0) + 1);
    }
    for (const x of s) {
      const k = norm(x);
      if (!k) continue;
      sizes.set(k, (sizes.get(k) || 0) + 1);
    }
  }

  return {
    colors: topByCount(colors, 18),
    sizes: topByCount(sizes, 18),
  };
}