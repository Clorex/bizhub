export type CloudinaryQuality = "auto" | "eco" | "good" | "low";

function isCloudinaryUploadUrl(u: string) {
  return u.includes("res.cloudinary.com") && u.includes("/upload/");
}

/**
 * Adds Cloudinary transforms to an existing Cloudinary delivery URL.
 * Example transforms: f_auto,q_auto,dpr_auto,w_320,h_240
 */
export function cloudinaryOptimizedUrl(
  url: string,
  opts?: {
    w?: number;
    h?: number;
    q?: CloudinaryQuality;
  }
) {
  const u = String(url || "");
  if (!u) return u;
  if (!isCloudinaryUploadUrl(u)) return u;

  const w = opts?.w ? Math.max(1, Math.floor(opts.w)) : undefined;
  const h = opts?.h ? Math.max(1, Math.floor(opts.h)) : undefined;

  const q = opts?.q || "auto";
  const qToken =
    q === "eco" ? "q_auto:eco" : q === "good" ? "q_auto:good" : q === "low" ? "q_auto:low" : "q_auto";

  const tParts = ["f_auto", qToken, "dpr_auto"];
  if (w) tParts.push(`w_${w}`);
  if (h) tParts.push(`h_${h}`);

  const t = tParts.join(",");

  // Insert transform right after /upload/
  return u.replace("/upload/", `/upload/${t}/`);
}

/**
 * Build a small srcSet for responsive delivery (reduces data on mobile).
 */
export function cloudinarySrcSet(
  url: string,
  widths: number[],
  opts?: { q?: CloudinaryQuality; h?: number }
) {
  const clean = Array.from(new Set(widths.map((x) => Math.max(1, Math.floor(x)))))
    .filter(Boolean)
    .sort((a, b) => a - b);

  return clean.map((w) => `${cloudinaryOptimizedUrl(url, { w, h: opts?.h, q: opts?.q })} ${w}w`).join(", ");
}