// app/resources/page.jsx

export const metadata = {
  title: "Resources | Stay in Motion PT",
  description:
    "Curated guides and references for stretching, rehab, flexibility, and understanding PT care.",
  alternates: { canonical: "https://stayinmotionpt.com/resources" },
  openGraph: {
    url: "https://stayinmotionpt.com/resources",
    title: "Resources | Stay in Motion PT",
    description:
      "Patient-friendly guides for stretching, flexibility, back care, work rehab, and more.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

// Curated resources (from your original list)
const docs = [
  {
    title: "Mindful Stretching Guide",
    href: "https://uhs.berkeley.edu/sites/default/files/wellness-mindfulstretchingguide.pdf",
    blurb:
      "A mindful approach to stretching that enhances flexibility, awareness, and neuromuscular coordination.",
  },
  {
    title: "Improving Flexibility – Illustrated Guide",
    href: "https://www.fammed.wisc.edu/files/webfm-uploads/documents/outreach/im/tool-improving-flexibility.pdf",
    blurb:
      "Illustrated flexibility techniques from the Osher Center at University of Wisconsin.",
  },
  {
    title: "Low Back Pain Exercise Sheet",
    href: "https://uhs.berkeley.edu/sites/default/files/lowbackpain.pdf",
    blurb:
      "Simple stretching routines targeting the lower back—visual and easy to follow.",
  },
  {
    title: "Work Rehabilitation Guide (WA State)",
    href: "https://lni.wa.gov/patient-care/treating-patients/treatment-guidelines-and-resources/_docs/WorkRehabGuideline_Final_Formatting_Updates_0423.pdf",
    blurb:
      "Detailed guidance for returning safely to work with injury-adapted tasks.",
  },
  {
    title: "Strength Training for Older Adults",
    href: "https://www.atchison.k-state.edu/docs/food_safety_health_nutrition/Strength%20Training%20for%20Older%20Adults.pdf",
    blurb:
      "Evidence-based guide to building strength in aging populations—exercise plans included.",
  },
  {
    title: "Outpatient Rehab Therapy Services (Medicare)",
    href: "https://www.cms.gov/Outreach-and-Education/Medicare-Learning-Network-MLN/MLNProducts/Downloads/OutptRehabTherapy-Booklet-MLN905365print-friendly.pdf",
    blurb:
      "Explains outpatient rehab services, billing, documentation, and Medicare procedures.",
  },
  {
    title: "Preparing for Tele-Physical Therapy",
    href: "https://telehealth.hhs.gov/providers/best-practice-guides/telehealth-for-physical-therapy/preparing-patients-for-tele-physical-therapy",
    blurb:
      "HHS guide to help patients prepare and feel confident for telehealth PT sessions.",
  },
  {
    title: "Walk With Ease – Coaching Manual",
    href: "https://geriatrictoolkit.missouri.edu/consumer/Walk_With_Ease_AF_Manual.pdf",
    blurb:
      "Evidence-based walking program manual to increase safe activity.",
  },
];

function getHost(url) {
  try {
    return new URL(url).host.replace("www.", "");
  } catch {
    return "";
  }
}

function isPdf(url) {
  return /\.pdf($|\?)/i.test(url);
}

export default function ResourcesPage() {
  // Structured data (ItemList)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: docs.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: d.href,
      name: d.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="section">
        <div className="container-site">
          {/* Hero */}
          <div className="text-center mb-8">
            <span className="badge">Curated by your PT</span>
            <h1 className="h1 mt-3">Resources &amp; Tools</h1>
            <p className="lead mt-3">
              Patient-friendly guides for stretching, flexibility, back care, work rehab, and more.
            </p>
          </div>

          {/* Grid of resource cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {docs.map((d) => (
              <article key={d.href} className="card p-5 flex flex-col">
                {/* Top row: badge + host */}
                <div className="flex items-center justify-between gap-3">
                  <span className="badge">
                    {isPdf(d.href) ? "PDF" : "Web"}
                  </span>
                  <span className="text-sm text-muted">{getHost(d.href)}</span>
                </div>

                {/* Title */}
                <h2 className="h3 mt-3">{d.title}</h2>

                {/* Blurb */}
                <p className="text-muted mt-2">{d.blurb}</p>

                {/* Actions */}
                <div className="mt-5">
                  <a
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary inline-flex"
                    aria-label={`Open resource: ${d.title}`}
                  >
                    {/* External link icon (inline SVG) */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="mr-2"
                      aria-hidden="true"
                    >
                      <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z" />
                      <path d="M5 5h6V3H3v8h2V5zm0 14h6v2H3v-8h2v6zm16-6h-2v6h-6v2h8v-8z" />
                    </svg>
                    Open resource
                  </a>
                </div>
              </article>
            ))}
          </div>

          {/* Helpful note */}
          <div className="card p-5 mt-6">
            <p className="text-sm text-muted">
              These links point to reputable organizations and universities. If a PDF
              opens in your browser, you can use its built-in menu to download or print.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
