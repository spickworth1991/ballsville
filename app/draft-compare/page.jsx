// app/draft-compare/page.jsx

import { Suspense } from "react";
import DraftCompareHomeClient from "@/components/draftCompare/DraftCompareHomeClient";

export const dynamic = "force-static";

export default function DraftCompareHomePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <DraftCompareHomeClient />
    </Suspense>
  );
}
