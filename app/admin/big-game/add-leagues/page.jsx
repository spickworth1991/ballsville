import AdminGuard from "@/components/AdminGuard";
import AddBigGameLeaguesClient from "./AddBigGameLeaguesClient";
import { CURRENT_SEASON } from "@/lib/season";

// export const runtime = "edge";

export default function Page({ searchParams }) {
  const season = searchParams?.season || String(CURRENT_SEASON);
  return (
    <AdminGuard>
      <AddBigGameLeaguesClient initialSeason={season} />
    </AdminGuard>
  );
}
