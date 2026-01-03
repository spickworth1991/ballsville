"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import RedraftLeaguesClient from "./RedraftLeaguesClient";



export default function RedraftDynamicBlocks({
  season,
  version = "0",
  manifest = null,
  showOwner = true,
  showLeagues = true,
  embeddedLeagues = false,
}) {
  return (
    <>
      {showOwner ? (
        <OwnerHeroBlock
          mode="redraft"
          season={season}
          title="Owner Updates"
          version={version}
          manifest={manifest}
        />
      ) : null}

      {showLeagues ? (
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Leagues</h2>
            <p className="text-sm text-white/70">Browse all active Redraft leagues for this season.</p>
          </div>
          <RedraftLeaguesClient
            embedded={embeddedLeagues}
            season={season}
            version={version}
            manifest={manifest}
          />
        </section>
      ) : null}
    </>
  );
}