// config/siteConfig.js

export const siteConfig = {
  // Basic branding
  name: "The Ballsville Game",
  shortName: "Ballsville",
  title: "The Ballsville Game | Where big payouts meet great odds!",
  tagline: "Fantasy Football Tournaments & Leagues",
  brandslogan1: "Big Payouts.",
  brandslogan2: "Great Odds.",
  default: "Ballsville",

  // Core SEO
  description:
    "The BALLSVILLE formula was developed to combine big fantasy football payouts with great odds across bestball, redraft, dynasty, and more.",
  domain: "https://www.theballsvillegame.com",
  ogImage: "/og/home.jpg",

  // "Business" details (for schema.org / footer)
  // If you don't want a public phone, leave this empty string.
  phone: "",
  priceRange: "$$", // you can tweak or leave as-is; it's just a hint for schema
  // Use a generic org type instead of a medical business
  businessType: "SportsOrganization", // e.g. SportsOrganization, Organization, WebSite
  medicalSpecialty: "", // not used anymore, but kept so layout.jsx doesn't choke
  footer: "Global fantasy football tournaments & leagues.",

  // Address is required by the current JSON-LD shape, so we use an "online only" style.
  // If you want to supply a real HQ city later, just update these.
  address: {
    streetAddress: "Online Only",
    locality: "Internet",
    region: "NA",
    postalCode: "00000",
    country: "US",
  },

  // Geo is also required by current layout; neutral coordinates.
  geo: {
    lat: 0,
    lng: 0,
  },

  // Logo (relative path; layout.jsx turns it into full URL)
  logo: "/logo_noBG.png",

  // Opening hours – for an online brand, just say always open.
  openingHours: [
    {
      days: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
  ],

  // Socials (fill in as you get real URLs; empty strings get filtered out)
  socials: {
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "https://youtube.com/@theballsvillegame",
    discord: "https://discord.gg/mtqCRRW3",
  },

  // Hero video (YouTube ID and optional MP4 fallback)
  // If you add a YouTube ID later, plug it in here.
  heroVideoId: "",
  heroVideoMp4: "/videos/ballsville-promo.mp4",

  // About video (same deal)
  aboutVideoId: "",
  aboutVideoMp4: "/videos/ballsville-history.mp4",

  // Direct links used elsewhere
  youtubeUrl: "https://youtube.com/@theballsvillegame",
  discordUrl: "https://discord.gg/mtqCRRW3",
};
