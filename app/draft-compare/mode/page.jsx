// app/draft-compare/mode/page.jsx

import { Suspense } from "react";
import DraftCompareModeClient from "@/components/draftCompare/DraftCompareModeClient";

export const dynamic = "force-static";

export default function DraftCompareModePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <DraftCompareModeClient />
    </Suspense>
  );
}
