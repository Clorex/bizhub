import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeader({
  title,
  subtitle,
  href,
  hrefLabel = "See all",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="text-h3 text-gray-900">{title}</h2>
        {subtitle && <p className="text-caption text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      {href && (
        <Link
          href={href}
          className="text-caption font-semibold text-orange-600 hover:text-orange-700 transition inline-flex items-center gap-0.5"
        >
          {hrefLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
