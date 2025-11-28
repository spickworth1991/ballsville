// app/location/page.jsx
import Link from "next/link";

export const metadata = {
  title:
    "Our Location – Physical Therapy Clinic in Wixom, MI | Stay in Motion PT",
  description:
    "Find Stay in Motion Physical Therapy in Wixom, MI. Address, hours, parking, and directions.",
  alternates: { canonical: "https://stayinmotionpt.com/location" },
  openGraph: {
    url: "https://stayinmotionpt.com/location",
    title:
      "Our Location – Physical Therapy Clinic in Wixom, MI | Stay in Motion PT",
    description: "Address, hours, parking, and directions to our Wixom clinic.",
    images: [{ url: "/og/home.jpg", width: 1200, height: 630 }],
  },
};

export default function Page() {
  const name = "Stay in Motion Physical Therapy";
  const street = "30990 S Wixom Rd";
  const city = "Wixom";
  const region = "MI";
  const postal = "48393";
  const phone = "+1-734-251-3046";
  const address = `${street}, ${city}, ${region} ${postal}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(
    address
  )}&z=15&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address
  )}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name,
    telephone: phone,
    url: "https://stayinmotionpt.com/location",
    image: "https://stayinmotionpt.com/logo.png",
    medicalSpecialty: "PhysicalTherapy",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: street,
      addressLocality: city,
      addressRegion: region,
      postalCode: postal,
      addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: 42.524, longitude: -83.536 },
    hasMap: mapEmbed,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "18:00",
      },
    ],
    sameAs: [
      "https://www.facebook.com/stayinmotionpt",
      "https://www.instagram.com/stayinmotionpt",
      "https://www.linkedin.com/company/stayinmotionpt",
    ],
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
            <span className="badge">Visit our Wixom clinic</span>
            <h1 className="h1 mt-3">Our Location</h1>
            <p className="lead mt-3">
              Easy parking, quick access, and a welcoming space for your care.
            </p>
          </div>

          {/* Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Info card */}
            <div className="card p-6">
              <h2 className="h3">{name}</h2>
              <address className="not-italic mt-2">
                {street}
                <br />
                {city}, {region} {postal}
              </address>

              <p className="mt-3">
                <a href={`tel:${phone}`} className="underline decoration-accent">
                  {phone}
                </a>
              </p>

              <div className="divider-subtle mt-6 pt-6">
                <h3 className="font-semibold mb-2">Hours</h3>
                <p className="text-muted">Mon–Fri: 8:00 AM – 6:00 PM</p>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-2">Parking &amp; Entrance</h3>
                <p className="text-muted">
                  Free parking is available in the main lot directly in front of
                  the clinic entrance.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:flex sm:gap-4">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Get Directions
                </a>
                <Link href="/contact" className="btn btn-outline">
                  Contact Us
                </Link>
              </div>
            </div>

            {/* Map card */}
            <div className="card overflow-hidden">
              <iframe
                title="Map to Stay in Motion PT"
                src={mapEmbed}
                className="w-full h-80 border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>

          {/* Driving directions */}
          <div className="card p-6 mt-6">
            <h3 className="h3 mb-2">Driving Directions</h3>
            <ul className="list-disc list-inside space-y-1 text-muted">
              <li>From I-96: Exit Wixom Rd, head north ~1.4 mi; clinic on right.</li>
              <li>From Pontiac Trail: Turn south on Wixom Rd, continue 0.6 mi.</li>
            </ul>

            <p className="mt-4">
              <Link href="/contact" className="underline decoration-accent hover:text-primary">
                Questions? Contact us →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
