import React from "react";
import { Lightbulb } from "lucide-react";

interface InsightTextProps {
  text: string;
  className?: string;
  showIcon?: boolean;
}

export default function InsightText({
  text,
  className = "",
  showIcon = true,
}: InsightTextProps) {
  if (!text) return null;

  return (
    <div className={`flex items-start gap-2.5 text-body text-gray-600 leading-relaxed bg-orange-50/50 border border-orange-100 rounded-xl px-4 py-3 mt-4 ${className}`}>
      {showIcon && (
        <Lightbulb className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
      )}
      <span>{text}</span>
    </div>
  );
}
