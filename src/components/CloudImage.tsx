"use client";

import { cloudinaryOptimizedUrl, cloudinarySrcSet, type CloudinaryQuality } from "@/lib/cloudinary/url";
import { useNetworkProfile } from "@/lib/net/useNetworkProfile";

function chooseQuality(saveData: boolean, effectiveType: string): CloudinaryQuality {
  if (saveData) return "eco";
  if (effectiveType === "slow-2g" || effectiveType === "2g") return "eco";
  if (effectiveType === "3g") return "good";
  return "auto";
}

function capWidthByNetwork(w: number, saveData: boolean, effectiveType: string) {
  // cap to reduce data on slow networks
  if (saveData) return Math.min(w, 700);
  if (effectiveType === "slow-2g" || effectiveType === "2g") return Math.min(w, 480);
  if (effectiveType === "3g") return Math.min(w, 900);
  return w;
}

export function CloudImage(props: {
  src: string;
  alt: string;
  w: number;
  h?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const { saveData, effectiveType } = useNetworkProfile();

  const q = chooseQuality(saveData, effectiveType);
  const w = capWidthByNetwork(props.w, saveData, effectiveType);
  const h = props.h;

  const src = cloudinaryOptimizedUrl(props.src, { w, h, q });
  const srcSet = cloudinarySrcSet(props.src, [Math.round(w * 0.7), w, Math.round(w * 1.4)], { q, h });

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={props.sizes || "100vw"}
      alt={props.alt}
      className={props.className}
      loading={props.priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={props.priority ? "high" : "auto"}
    />
  );
}