import AdminNav from "@/components/admin/AdminNav";
import AddGauntletLeaguesClient from "./AddGauntletLeaguesClient";

// export const dynamic = "force-dynamic";

export default function AddGauntletLeaguesPage() {
  return (
    <main className="section">
      <div className="container-site">
        <AdminNav active="gauntlet" />
        <div className="card bg-card-surface border border-subtle p-5">
          <h1 className="h2">Gauntlet • Add Leagues (Sleeper)</h1>
          <p className="text-muted mt-2">
            Pull leagues from a Sleeper username, then assign them to a Gauntlet Legion.
          </p>
        </div>
        <div className="mt-6">
          <AddGauntletLeaguesClient />
        </div>
      </div>
    </main>
  );
}
