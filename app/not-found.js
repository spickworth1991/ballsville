import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section">
      <div className="container-site max-w-3xl mx-auto">
        <section className="relative overflow-hidden card p-8 md:p-10">
          {/* Decorative background (token-based) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, color-mix(in oklab, var(--color-primary) 24%, transparent) 0%, transparent 70%)",
            }}
          />

          {/* Logo */}
          <div className="flex items-center justify-center">
            <img
              src="/logo_noBG.png"
              alt="Stay in Motion Physical Therapy"
              className="h-40 w-auto md:h-48"
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-center h1 text-primary">
            404 — Page Not Found
          </h1>

          {/* Copy */}
          <p className="mt-3 text-center">
            The page you’re looking for doesn’t exist or may have been moved.
            Let’s get you back on track.
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="btn btn-primary rounded-full px-6 py-3">
              Go Home
            </Link>
            {/* <Link href="/contact" className="btn btn-outline rounded-full px-6 py-3">
              Contact Us
            </Link> */}
          </div>

          {/* Quick links */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { name: "About", href: "/about" },
              { name: "Constitution", href: "/constitution" },
              // { name: "FAQ", href: "/faq" },
              // { name: "Insurance", href: "/insurance" },
              // { name: "Resources", href: "/resources" },
              // { name: "Careers", href: "/careers" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group bg-bg rounded-xl card p-4 flex items-center justify-between hover:shadow-md transition"
              >
                <span className="font-medium">{link.name}</span>
                <span className="text-accent group-hover:text-primary transition">→</span>
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted">
          If you typed the address, double-check the spelling. If you followed a link,
          it may be outdated.
        </p>
      </div>
    </main>
  );
}
