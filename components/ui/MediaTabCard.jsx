// components/ui/MediaTabCard.jsx
// Shared card used for Division/Legion "tabs" and League "tabs".
// Keeps BigGame structure (content -> image -> footer) + Gauntlet hover lift.

import Link from "next/link";

/**
 * Shared card used across BigGame + Gauntlet.
 *
 * - For internal links, uses next/link.
 * - For external links (e.g., Sleeper), use `external`.
 * - `footerLabel` is an alias for `footerText` (keeps older call sites working).
 */
export default function MediaTabCard({
  href,
  title,
  subtitle,
  metaLeft,
  metaRight,
  imageSrc,
  imageAlt,
  footerText,
  footerLabel,
  badge,
  badgeRight,
  className = "",
  external = false,
  disabled = false,
  // Next.js Link prefetch is on by default and can cause background requests.
  // Allow callers to disable it per-card where needed.
  prefetch = true,
}) {
  const footer = footerLabel ?? footerText ?? "View";
  const safeHref = href || "#";
  const interactive = !disabled && safeHref !== "#";

  const Wrapper = interactive ? (external ? "a" : Link) : "div";
  const wrapperProps = !interactive
    ? {}
    : external
    ? { href: safeHref, target: "_blank", rel: "noreferrer" }
    : { href: safeHref, prefetch };

  return (
    <Wrapper
      {...wrapperProps}
      className={`group relative overflow-hidden rounded-2xl border border-subtle bg-card-surface shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/70 ${
        interactive ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30" : "cursor-default opacity-70"
      } ${className}`}
    >
      {/* ambient glow */}
      <div
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ${
          interactive ? "group-hover:opacity-100" : ""
        }`}
      >
        <div className="absolute -top-24 -left-16 h-48 w-48 rounded-full bg-[color:var(--color-accent)]/14 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-[color:var(--color-primary)]/12 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col">
        {/* Header */}
        <div className="p-5">
          {badge && <div className="badge mb-3">{badge}</div>}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight truncate">{title}</h3>
              {subtitle && <p className="mt-1 text-sm text-muted line-clamp-2">{subtitle}</p>}
            </div>

            {badgeRight && (
              <span className="badge shrink-0">{badgeRight}</span>
            )}
          </div>

          {(metaLeft || metaRight) && (
            <div className="mt-3 flex items-center justify-between text-[0.75rem] text-muted">
              <span className="truncate">{metaLeft}</span>
              <span className="shrink-0">{metaRight}</span>
            </div>
          )}
        </div>

        {/* Media */}
        {imageSrc && (
          <div className="px-5">
            <div className="overflow-hidden rounded-xl border border-subtle bg-subtle-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={imageAlt || String(title || "")}
                className="h-40 w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-subtle px-5 py-4 text-sm">
          <span className="text-muted">{footer}</span>
          <span className="text-primary transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Wrapper>
  );
}
