import DivisionPageClient from "./DivisionPageClient";

export const metadata = {
  title: "Big Game Division | BALLSVILLE",
  description: "View leagues inside a single BALLSVILLE Big Game division.",
};

/**
 * IMPORTANT:
 * This site is built with `output: "export"` (static export).
 * That means query params (searchParams) are NOT available at build time.
 * We must read `?division=` and `?year=` on the client.
 */
export default function BigGameDivisionPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <DivisionPageClient />
    </Suspense>
  );
}
