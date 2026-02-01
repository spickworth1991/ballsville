// app/admin/big-game/add-leagues/page.jsx
import AdminGuard from "@/components/AdminGuard";
import AddBigGameLeaguesClient from "./AddBigGameLeaguesClient";

// IMPORTANT: do NOT set runtime="edge" on pages that will be statically exported.
// export const runtime = "edge";

export default function Page({ searchParams }) {
  const season = searchParams?.season || "";
  return (
    <AdminGuard>
      <AddBigGameLeaguesClient initialSeason={season} />
    </AdminGuard>
  );
}
