"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

export function BrandLogo({
  size = 34,
  className,
  priority = false,
  alt = "myBizHub",
}: {
  size?: number; // px
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src="/brand/logo.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn("rounded-xl object-contain", className)}
    />
  );
}