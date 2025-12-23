import Link from "next/link";
import Image from "next/image";

/**
 * Shared selection tile used for Big Game + Gauntlet division/league cards.
 *
 * Combines:
 * - Big Game feel: centered logo/image with content around it
 * - Gauntlet feel: stronger hover (lift + shadow + subtle image zoom)
 */
export default function DivisionLeagueTabCard({
  href,
  external = false,
  target,
  rel,
  title,
  subtitle,
  badge,
  imageSrc,
  imageAlt,
  rightTop,
  rightBottom,
  className = "",
}) {
  const CardTag = !href ? "div" : external ? "a" : Link;

  return (
    <CardTag
      href={href || undefined}
      target={href && external ? target || "_blank" : undefined}
      rel={href && external ? rel || "noopener noreferrer" : undefined}
      className={
        "group relative overflow-hidden rounded-2xl border border-subtle bg-card-surface p-4 shadow-sm " +
        "transition will-change-transform hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/50 " +
        className
      }
    >
      {/* subtle background glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-[color:var(--color-accent)]/10 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-[color:var(--color-primary)]/10 blur-3xl" />
      </div>

      {/* 3-column header: left content, centered image, right content */}
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">{title}</div>
          {subtitle ? <div className="mt-1 truncate text-xs text-muted">{subtitle}</div> : null}
        </div>

        <div className="flex items-center justify-center">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-subtle bg-subtle-surface shadow-inner">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={imageAlt || title || ""}
                fill
                sizes="56px"
                className="object-cover transition-transform duration-200 group-hover:scale-[1.06]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[0.65rem] font-semibold text-muted">
                {String(title || "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1 text-right">
          {badge ? <span className="badge">{badge}</span> : null}
          {rightTop ? <div className="truncate text-xs text-muted">{rightTop}</div> : null}
          {rightBottom ? <div className="truncate text-[0.7rem] text-muted">{rightBottom}</div> : null}
        </div>
      </div>

      {/* bottom hint */}
      {href ? (
        <div className="relative mt-3 flex items-center justify-between text-[0.7rem] text-muted">
          <span className="opacity-90">Open</span>
          <span className="translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </div>
      ) : null}
    </CardTag>
  );
}
