// app/layout.jsx
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { siteConfig } from "@/app/config/siteConfig";


export const metadata = {
  metadataBase: new URL(siteConfig.domain),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  robots: "index, follow",
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    url: siteConfig.domain,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
  alternates: { canonical: siteConfig.domain },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo192.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3cadba" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1a1f" },
  ],
};

export default function RootLayout({ children }) {
  const fullLogoUrl = `${siteConfig.domain}${siteConfig.logo}`;
  const fullOgImageUrl = siteConfig.ogImage.startsWith("http")
    ? siteConfig.ogImage
    : `${siteConfig.domain}${siteConfig.ogImage}`;

  // Sitewide structured data
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": siteConfig.businessType,
    name: siteConfig.name,
    url: siteConfig.domain,
    logo: fullLogoUrl,
    image: fullOgImageUrl,
    telephone: siteConfig.phone,
    priceRange: siteConfig.priceRange,
    medicalSpecialty: siteConfig.medicalSpecialty,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.streetAddress,
      addressLocality: siteConfig.address.locality,
      addressRegion: siteConfig.address.region,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.geo.lat,
      longitude: siteConfig.geo.lng,
    },
    openingHoursSpecification: siteConfig.openingHours.map((slot) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: slot.days,
      opens: slot.opens,
      closes: slot.closes,
    })),
    sameAs: Object.values(siteConfig.socials).filter(Boolean),
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: siteConfig.phone,
        contactType: "customer service",
      },
    ],
  };

  // Fallback meta for Supabase so previews don’t crash if envs are missing
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const SUPABASE_ANON =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="overflow-x-hidden"
    >

      <head>
        {/* Sitewide structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />

        {/* Google Search Console */}
        <meta
          name="google-site-verification"
          content="IGEMpigWrIPdpL7KyJuLxvhducEk-UU-PkWOVm2zSLk"
        />

        {/* Preconnects / DNS Prefetch for perf */}
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//i.ytimg.com" />
        <link rel="dns-prefetch" href="//www.youtube.com" />

        {/* Supabase fallbacks for client (read by getSupabase()) */}
        <meta name="supabase-url" content={SUPABASE_URL} />
        <meta name="supabase-anon" content={SUPABASE_ANON} />
      </head>

      {/* Body uses theme tokens only; cosmic bg handled by .page-bg on content */}
      <body className="bg-bg text-fg overflow-x-hidden">
        <Navbar />
        <div className="page-bg">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
