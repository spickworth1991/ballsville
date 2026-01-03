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
        <RedraftLeaguesClient
          embedded={embeddedLeagues}
          title="League Directory"
          season={season}
          version={version}
          manifest={manifest}
        />
      ) : null}
    </>
  );
}