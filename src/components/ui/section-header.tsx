import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  metaLeft?: string;
  metaRight?: string;
  className?: string;
}

/**
 * Section Header
 * Used at the top of each analytics section.
 * Title + optional subtitle + optional action button.
 * Optional meta line (range / last updated).
 */
export default function SectionHeader({
  title,
  subtitle,
  action,
  metaLeft,
  metaRight,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div className="min-w-0">
        <h3 className="analytics-section-title">{title}</h3>
        {subtitle && <p className="analytics-section-subtitle">{subtitle}</p>}

        {(metaLeft || metaRight) && (
          <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-gray-400">
            <span className="truncate">{metaLeft || ""}</span>
            <span className="shrink-0">{metaRight || ""}</span>
          </div>
        )}
      </div>

      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}