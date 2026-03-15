// app/admin/dynasty/add-leagues/page.jsx
import { Suspense } from "react";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import AddDynastyLeaguesClient from "./AddDynastyLeaguesClient";

export default function Page() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site w-full max-w-6xl px-3 sm:px-6 lg:px-10 space-y-5 sm:space-y-8">
          <AdminNav
            eyebrow="Admin · Dynasty"
            title="Add leagues from Sleeper"
            description="Search a Sleeper username, choose the correct leagues for the selected year, and add them directly into a Dynasty theme."
            publicHref="/dynasty"
            publicLabel="← View Public Dynasty Page"
          />

          <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-10 text-white/70">Loading…</div>}>
            <AddDynastyLeaguesClient />
          </Suspense>
        </div>
      </section>
    </AdminGuard>
  );
}
