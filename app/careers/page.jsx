import CareersForm from "@/components/CareersForm";

export const metadata = {
  title: "Careers | Stay in Motion PT",
  description: "Join the team at Stay in Motion Physical Therapy (Wixom, MI).",
  alternates: { canonical: "https://stayinmotionpt.com/careers" },
  openGraph: {
    url: "https://stayinmotionpt.com/careers",
    title: "Careers | Stay in Motion PT",
    description: "Open roles and application form.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

// Server-safe openings list
const positions = [
  {
    title: "Physical Therapist (DPT)",
    location: "Wixom, MI — Full-time",
    description:
      "Evaluate, treat, and progress diverse orthopedic and sports cases. Dry needling experience a plus.",
  },
  {
    title: "Physical Therapist Assistant (PTA)",
    location: "Wixom, MI — Part-time",
    description:
      "Support plan of care execution, patient education, and progression of exercises under PT supervision.",
  },
];

export default function Page() {
  return (
    <>
      {/* Hero */}
      <div
        className="w-full h-[300px] md:h-[400px] bg-cover bg-center text-card flex flex-col items-center justify-center text-center"
        style={{ backgroundImage: "url('/photos/careers-hero.jpg')" }}
        role="img"
        aria-label="Physical therapy careers background"
      >
        <span className="badge" style={{ background: "color-mix(in oklab, var(--color-primary) 18%, transparent)", color: "var(--color-card)" }}>
          We’re growing
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold drop-shadow-lg">Join Our Team</h1>
        <p className="text-lg md:text-xl mt-3 drop-shadow-md max-w-xl">
          Help us redefine recovery with passion, precision, and purpose.
        </p>
      </div>

      {/* Positions + Form */}
      <section className="section">
        <div className="container-site">
          <h2 className="h2 text-center mb-10 text-primary">Current Openings</h2>

          <div className="max-w-4xl mx-auto grid gap-6 mb-12">
            {positions.map((pos, i) => (
              <article key={i} className="card p-6">
                <h3 className="text-xl font-semibold text-primary">{pos.title}</h3>
                <p className="text-sm text-muted italic mb-2">{pos.location}</p>
                <p>{pos.description}</p>
              </article>
            ))}
          </div>

          <div className="max-w-2xl mx-auto card p-6 shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Submit Your Application</h2>
            <CareersForm positions={positions} />
          </div>
        </div>
      </section>
    </>
  );
}
