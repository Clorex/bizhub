import Link from "next/link";

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
        <p className="text-sm font-extrabold text-biz-ink">{title}</p>
        {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
      </div>

      {href ? (
        <Link href={href} className="text-xs font-semibold text-biz-accent">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}