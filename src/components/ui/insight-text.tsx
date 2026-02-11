import React from 'react';

interface InsightTextProps {
  text: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Insight Text Component
 * Displays actionable insight with lightbulb icon.
 * Light grey background, rounded corners.
 */
export default function InsightText({
  text,
  className = '',
  showIcon = true,
}: InsightTextProps) {
  if (!text) return null;

  return (
    <div
      className={`
        flex items-start gap-2
        text-sm text-gray-500 leading-relaxed
        bg-gray-50 rounded-xl
        px-4 py-3 mt-4
        ${className}
      `}
    >
      {showIcon && (
        <span className="flex-shrink-0 text-base leading-none mt-0.5">💡</span>
      )}
      <span>{text}</span>
    </div>
  );
}