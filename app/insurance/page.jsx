import Link from "next/link";
import FadeIn from "@/components/FadeIn"; // tiny client wrapper for motion

export const metadata = {
  title: "Insurance & Payment | Stay in Motion PT",
  description:
    "Learn about insurance, out-of-network reimbursement, cash rates, and ways to pay at Stay in Motion PT (Wixom, MI).",
  alternates: { canonical: "https://stayinmotionpt.com/insurance" },
  openGraph: {
    url: "https://stayinmotionpt.com/insurance",
    title: "Insurance & Payment | Stay in Motion PT",
    description:
      "Insurance status, superbill, out-of-network guidance, transparent cash rates, and ways to pay.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

export default function InsurancePage() {
  return (
    <section className="section">
      <div className="container-site">
        {/* HERO */}
        <FadeIn className="text-center mb-8">
          <span className="badge">Simple • Transparent • Helpful</span>
          <h1 className="h1 mt-3">Insurance & Payment</h1>
          <p className="lead mt-3">
            Temporarily cash-based while credentialing is finalized. We’ll
            provide a <strong>superbill</strong> for possible out-of-network reimbursement.
          </p>
        </FadeIn>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <FadeIn delay={0.05} className="card p-6">
            <h2 className="h3">Insurance Status & Cash Rates</h2>
            <p className="text-muted mt-1">
              We’re currently finalizing in-network credentialing. In the meantime,
              we offer clear cash pricing and will provide a superbill for potential reimbursement.
            </p>

            <div className="divider-subtle mt-6 pt-6">
              <h3 className="font-semibold mb-2">Rates</h3>
              <ul className="divide-y border-subtle divide-y-0">
                <li className="flex justify-between py-2 border-b border-subtle">
                  <span>Physical Therapy Evaluation</span>
                  <strong>$140</strong>
                </li>
                <li className="flex justify-between py-2 border-b border-subtle">
                  <span>Physical Therapy Treatment</span>
                  <strong>$120</strong>
                </li>
                <li className="flex justify-between py-2">
                  <span>30-Minute Dry Needling / Recovery</span>
                  <strong>$75</strong>
                </li>
              </ul>
            </div>

            <p className="mt-4">
              Your movement and recovery shouldn’t wait — let’s get started today.
            </p>
          </FadeIn>

          {/* Card 2 */}
          <FadeIn delay={0.10} className="card p-6">
            <h2 className="h3">Out-of-Network Reimbursement</h2>
            <p className="text-muted mt-1">
              If you have out-of-network benefits, you may be reimbursed directly by your insurer.
              We’ll provide a superbill after each visit.
            </p>

            <ol className="mt-4 space-y-3">
              <li className="border-b border-subtle pb-3">
                <strong>1) Call your plan</strong>
                <p className="text-muted">
                  Ask about out-of-network physical therapy benefits and whether a referral is required.
                </p>
              </li>
              <li className="border-b border-subtle pb-3">
                <strong>2) Pay at the visit</strong>
                <p className="text-muted">
                  You’ll pay our transparent cash rate. We’ll give you an itemized superbill (with codes) for your claim.
                </p>
              </li>
              <li>
                <strong>3) Submit the superbill</strong>
                <p className="text-muted">
                  Send it to your insurer. If eligible, reimbursement is paid to you according to your plan.
                </p>
              </li>
            </ol>

            <div className="divider-subtle mt-6 pt-6">
              <p className="text-sm text-muted">
                Tip: Ask your insurer about deductible status, coinsurance, and visit limits for outpatient PT.
              </p>
            </div>
          </FadeIn>

          {/* Card 3 */}
          <FadeIn delay={0.15} className="card p-6">
            <h2 className="h3">Ways to Pay</h2>
            <ul className="mt-2 space-y-2">
              {/* <li className="flex items-start gap-2">
                <span className="badge">HSA / FSA</span>
                <div>
                  <strong className="block">Health accounts welcomed</strong>
                  <p className="text-muted">Use HSA or FSA cards for eligible services.</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="badge">Cards</span>
                <div>
                  <strong className="block">All major credit/debit</strong>
                  <p className="text-muted">Pay at the time of service; no surprises.</p>
                </div>
              </li> */}
              <li className="flex items-start gap-8">
                <span className="badge">Cash</span>
                <div>
                  <strong className="block">American Dollar</strong>
                  <p className="text-muted">Pay at the time of service; no surprises. We are working on cashless payments.</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="badge">Superbill</span>
                <div>
                  <strong className="block">Easy documentation</strong>
                  <p className="text-muted">We’ll generate what your insurer needs.</p>
                </div>
              </li>
            </ul>

            <div className="grid gap-3 sm:flex sm:gap-4 mt-6">
              <Link href="/contact" className="btn btn-primary">
                Ask a billing question
              </Link>
              <Link href="/services" className="btn btn-outline">
                See services
              </Link>
            </div>

            <p className="text-sm text-muted mt-6">
              Note: Reimbursement for out-of-network services varies by plan. Please check with your insurer.
            </p>
          </FadeIn>

          {/* CTA row */}
          <FadeIn delay={0.20} className="lg:col-span-3">
            <div className="card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="h3">Ready to get started?</h3>
                <p className="text-muted">
                  We’ll guide you on benefits and paperwork so you can focus on your recovery.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/contact" className="btn btn-primary">
                  Contact us to schedule
                </Link>
                <a href="tel:+17342513046" className="btn btn-outline">
                  Call (734) 251-3046
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
