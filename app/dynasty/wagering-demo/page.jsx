// app/dynasty/wagering-demo/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import DynastyWageringDemoClient from "../../../components/dynasty/DynastyWageringDemoClient";

const pageTitle = `Dynasty Wagering Demo | ${siteConfig.shortName}`;
const pageDesc =
  "A live Week 17 wagering tracker + explanation of how the $50 credit, Wager Bonus, and Championship Bonus work in BALLSVILLE Dynasty.";

export const metadata = {
  title: pageTitle,
  description: pageDesc,
  alternates: { canonical: "/dynasty/wagering-demo" },
  openGraph: {
    url: "/dynasty/wagering-demo",
    title: pageTitle,
    description: pageDesc,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <DynastyWageringDemoClient />;
}
