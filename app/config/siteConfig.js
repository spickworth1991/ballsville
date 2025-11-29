// config/siteConfig.js

export const siteConfig = {
  // Basic branding
  name: "The Ballsville Game",
  shortName: "Ballsville",
  title: "The Ballsville Game | Where big payouts meet great odds!",
  tagline: "Physical Therapy in Wixom, MI",
  brandslogan1:"Big Payouts.",
  brandslogan2:"Great Odds.",
  default:"Ballsville", 

  // Core SEO
  description:
    "The BALLSVILLE formula was developed to facilitate the combination of Big payouts and great odds.",
  domain: "https://ballsville.pages.dev", // change per project
  ogImage: "/og/home.jpg",

  // Business details
  phone: "+1-734-251-3046",
  priceRange: "$$",
  businessType: "Physiotherapy", // schema.org subtype
  medicalSpecialty: "PhysicalTherapy",
  footer: "Mon–Fri : 8am–6pm",

  address: {
    streetAddress: "30990 S Wixom Rd",
    locality: "Wixom",
    region: "MI",
    postalCode: "48393",
    country: "US",
  },

  geo: {
    lat: 42.524,
    lng: -83.536,
  },

  // Logo (relative path; we’ll turn it into a full URL in layout.jsx)
  logo: "/logo_noBG.png",

  // Opening hours
  openingHours: [
    {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "18:00",
    },
  ],

  // Socials (fill these in when you have real URLs)
  socials: {
    facebook: "https://www.facebook.com/yourpage",
    instagram: "https://www.instagram.com/yourpage",
    linkedin: "https://www.linkedin.com/company/yourpage",
  },
  // Hero video (YouTube ID and optional MP4 fallback)
  // heroVideoId: "8Bn8P3E8dHc",
  heroVideoMp4: "/videos/ballsville-promo.mp4",
  // aboutVideoId: "YOUR_YOUTUBE_ID",
  aboutVideoMp4: "/videos/ballsville-history.mp4",
  discordUrl: "https://discord.gg/mtqCRRW3",
};
