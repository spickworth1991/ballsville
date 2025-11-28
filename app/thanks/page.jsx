export const metadata = {
  title: "Thanks | Stay in Motion PT",
  description: "We received your message and will get back to you shortly.",
  alternates: { canonical: "https://stayinmotionpt.com/thanks" },
  openGraph: {
    url: "https://stayinmotionpt.com/thanks",
    title: "Thanks | Stay in Motion PT",
    description: "We received your message and will get back to you shortly.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return (
    <section className="relative overflow-hidden section">
      {/* soft token-based gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 400px at 20% 10%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 60%), radial-gradient(900px 500px at 80% 20%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 65%)",
        }}
      />

      <div className="relative container-site max-w-3xl mx-auto text-center">
        <img
          src="/logo_noBG.png"
          alt="Stay in Motion Physical Therapy"
          className="mx-auto h-16 w-auto mb-6"
          width={160}
          height={64}
          loading="lazy"
          decoding="async"
        />

        <h1 className="h1 text-primary">Thanks for reaching out!</h1>

        <p className="mt-4 lead">
          We received your message and will get back to you shortly. If it’s urgent,
          call us at{" "}
          <a href="tel:+1-734-251-3046" className="underline decoration-2 underline-offset-2">
            (734) 251-3046
          </a>.
        </p>

        {/* Divider using tokens */}
        <div
          className="mx-auto my-8 h-px w-24"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 30%, transparent), color-mix(in oklab, var(--color-accent) 40%, transparent), color-mix(in oklab, var(--color-primary) 30%, transparent))",
          }}
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/" className="btn btn-primary rounded-full px-6 py-3">
            Back to Home
          </a>
          <a href="/services" className="btn btn-outline rounded-full px-6 py-3">
            Explore Services
          </a>
        </div>

        <p className="mt-10 text-sm text-muted">
          Stay in Motion Physical Therapy • Wixom, MI
        </p>
      </div>
    </section>
  );
}
