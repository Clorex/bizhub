// FILE: src/components/reviews/ReviewStars.tsx
"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
};

const SIZES = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-7 h-7",
};

export function ReviewStars({ rating, size = "md", interactive = false, onRate }: Props) {
  const sizeClass = SIZES[size];

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRate?.(star)}
            className={cn(
              "transition-all",
              interactive && "cursor-pointer hover:scale-110 active:scale-95",
              !interactive && "cursor-default"
            )}
          >
            <Star
              className={cn(
                sizeClass,
                "transition-colors",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-none text-gray-300"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}