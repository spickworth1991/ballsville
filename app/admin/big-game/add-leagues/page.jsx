import AdminGuard from "@/components/AdminGuard";
import AddBigGameLeaguesClient from "./AddBigGameLeaguesClient";

export default function Page({ searchParams }) {
  const season = searchParams?.season || "";
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site">
          <AddBigGameLeaguesClient initialSeason={season} />
        </div>
      </section>
    </AdminGuard>
  );
}
