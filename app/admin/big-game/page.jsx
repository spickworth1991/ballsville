import AdminGuard from "@/components/AdminGuard";
import BigGameAdminClient from "@/components/admin/big-game/BigGameAdminClient";
import { CURRENT_SEASON } from "@/lib/season";

// export const runtime = "edge";

export default function Page() {
  const season = String(CURRENT_SEASON);
  return (
    <AdminGuard>
      <BigGameAdminClient initialSeason={season} />
    </AdminGuard>
  );
}
