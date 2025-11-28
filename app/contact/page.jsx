// app/contact/page.jsx
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contact | Stay in Motion PT",
  description: "Reach out to schedule physical therapy in Wixom, MI.",
  alternates: { canonical: "https://stayinmotionpt.com/contact" },
  openGraph: {
    url: "https://stayinmotionpt.com/contact",
    title: "Contact | Stay in Motion PT",
    description: "Reach out to schedule physical therapy in Wixom, MI.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

export default function ContactPage() {
  return (
    <section className="section">
      <div className="container-site">
        {/* Hero */}
        <div className="text-center mb-8">
          <span className="badge">We're here to help</span>
          <h1 className="h1 mt-3">Contact Us</h1>
          <p className="lead mt-3">
            We’d love to help you get back to moving your best.
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Contact info card */}
          <div className="card p-6">
            <h2 className="h3">Clinic Contact</h2>
            <p className="text-muted mt-1">
              Reach out with questions or to schedule your first visit.
            </p>

            <div className="mt-6 space-y-4">
              <p className="flex items-center gap-3">
                <FaPhoneAlt className="text-primary" />
                <a href="tel:+17342513046" className="underline decoration-accent">
                  (734) 251-3046
                </a>
              </p>
              <p className="flex items-center gap-3">
                <FaEnvelope className="text-primary" />
                <a
                  href="mailto:info@stayinmotionpt.com"
                  className="underline decoration-accent"
                >
                  info@stayinmotionpt.com
                </a>
              </p>
              <p className="flex items-center gap-3">
                <FaMapMarkerAlt className="text-primary" />
                <span>30990 S Wixom Rd, Wixom MI, 48393</span>
              </p>
            </div>

            <div className="divider-subtle mt-6 pt-6">
              <p className="text-sm text-muted">
                New patients: please arrive 10 minutes early to complete intake
                forms, or fill them out online before your visit.
              </p>
            </div>
          </div>

          {/* Form card */}
          <div className="card p-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
