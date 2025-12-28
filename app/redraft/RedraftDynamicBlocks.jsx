"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import RedraftLeaguesClient from "./RedraftLeaguesClient";
import { CURRENT_SEASON } from "@/lib/season";


export default function RedraftDynamicBlocks({
  season = CURRENT_SEASON,
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