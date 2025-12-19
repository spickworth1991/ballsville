// app/dynasty/rosters/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import DynastyRostersClient from "./DynastyRostersClient";

const pageTitle = `All Dynasty Rosters | ${siteConfig.shortName}`;
const pageDesc =
  "Live roster reference for the BALLSVILLE Dynasty Empire leagues (Dragons + Heroes).";

export const metadata = {
  title: pageTitle,
  description: pageDesc,
  alternates: { canonical: "/dynasty/rosters" },
  openGraph: {
    url: "/dynasty/rosters",
    title: pageTitle,
    description: pageDesc,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <DynastyRostersClient />;
}
