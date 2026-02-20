import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  metaLeft?: string;
  metaRight?: string;
  className?: string;
}

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
        <h3 className="text-h3 text-gray-900">{title}</h3>
        {subtitle && <p className="text-caption text-gray-500 mt-0.5">{subtitle}</p>}

        {(metaLeft || metaRight) && (
          <div className="mt-1 flex items-center justify-between gap-3 text-micro text-gray-400">
            <span className="truncate">{metaLeft || ""}</span>
            <span className="shrink-0">{metaRight || ""}</span>
          </div>
        )}
      </div>

      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}
