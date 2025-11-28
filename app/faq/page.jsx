import FAQItem from "@/components/FAQItem";

export const metadata = {
  title: "FAQ | Stay in Motion PT",
  description: "FAQ - Stay in Motion Physical Therapy.",
  alternates: { canonical: "https://stayinmotionpt.com/faq" },
  openGraph: {
    url: "https://stayinmotionpt.com/faq",
    title: "FAQ | Stay in Motion PT",
    description: "FAQ - Stay in Motion Physical Therapy.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

// FAQs
const faqs = [
  {
    question: "What should I bring to my first session?",
    answer:
      "Wear comfortable clothing, bring any referral paperwork, and arrive 10 minutes early with ID.",
  },
  {
    question: "Do you accept insurance?",
    answer:
      "We are temporarily cash-based while credentialing is finalized. A superbill is available upon request.",
  },
  {
    question: "Do I need a referral from my doctor?",
    answer:
      "In most cases, you can start physical therapy without a referral thanks to direct access laws in Michigan. However, some insurance plans may require one, so check with your provider.",
  },
  {
    question: "How long are sessions?",
    answer:
      "Most sessions last 45–60 minutes, depending on your treatment plan and goals.",
  },
  {
    question: "What should I wear to my appointment?",
    answer:
      "Comfortable, loose-fitting clothes that allow you to move freely and expose the area being treated are best. Athletic shoes are recommended.",
  },
  {
    question: "How many sessions will I need?",
    answer:
      "This varies by individual, condition, and goals. We will discuss your personalized treatment plan after your initial evaluation.",
  },
  {
    question: "Do you offer dry needling?",
    answer:
      "Yes, dry needling is available as part of a customized treatment plan when appropriate.",
  },
  {
    question: "Can I continue working out while in physical therapy?",
    answer:
      "In many cases, yes. We can help modify your workouts so you can stay active safely while recovering.",
  },
  {
    question: "What conditions do you treat?",
    answer:
      "We work with a variety of conditions including sports injuries, post-surgical recovery, chronic pain, joint problems, and mobility limitations.",
  },
  {
    question: "What is a superbill?",
    answer:
      "A superbill is an itemized receipt for services provided that you can submit to your insurance company for possible reimbursement.",
  },
];

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="section">
        <div className="container-site">
          <div className="text-center mb-8">
            <span className="badge">Answers you can trust</span>
            <h1 className="h1 mt-3">Frequently Asked Questions</h1>
            <p className="lead mt-3">
              Quick answers about visits, insurance, scheduling, and care.
            </p>
          </div>

          {/* Layout: left info card, right accordion */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: contact/help card */}
            <aside className="card p-6 lg:sticky lg:top-20 self-start">
              <h2 className="h3 mb-2">Still have a question?</h2>
              <p className="text-muted">
                We’re happy to help you figure out what’s best for your goals.
              </p>
              <div className="mt-5 grid gap-3">
                <a href="tel:7342513046" className="btn btn-primary">
                  Call (734) 251-3046
                </a>
                <a href="/contact" className="btn btn-outline">
                  Send a message
                </a>
                <a href="/services" className="btn btn-outline">
                  Explore services
                </a>
              </div>

              <div className="divider-subtle mt-6 pt-6">
                <p className="text-sm text-muted">
                  New patients: please arrive 10 minutes early to complete
                  intake forms, or fill them out online before your visit.
                </p>
              </div>
            </aside>

            {/* Right: FAQ list */}
            <div className="lg:col-span-2">
              <div className="card p-2">
                {faqs.map((f, idx) => (
                  <FAQItem key={f.question} {...f} defaultOpen={idx === 0} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
