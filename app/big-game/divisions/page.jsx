import BigGameDivisionClient from "@/lib/BigGameDivisionClient";

/**
 * Public division drill-down page.
 *
 * This project is deployed as a static export, so we use query params instead of
 * a dynamic route like /big-game/divisions/[division].
 *
 * Example:
 *   /big-game/divisions?division=star-wars&year=2025
 */
export default function BigGameDivisionPage({ searchParams }) {
  const yearRaw = searchParams?.year;
  const year = Number(yearRaw) || 2025;

  const divisionSlug = String(searchParams?.division || "").trim();

  return (
    <BigGameDivisionClient
      year={year}
      divisionSlug={divisionSlug}
      backHref={`/big-game?year=${encodeURIComponent(String(year))}`}
    />
  );
}
