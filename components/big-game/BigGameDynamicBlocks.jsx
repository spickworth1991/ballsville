"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import BigGameDivisionsClient from "@/components/big-game/BigGameDivisionsClient";

/**
 * NOTE: This component is intentionally "render-partial" so pages can place
 * Owner Updates and Divisions in their original visual positions while still
 * sharing the same manifest-based caching strategy.
 */
export default function BigGameDynamicBlocks({
  season,
  version = "0",
  manifest = null,
  showOwner = true,
  showDivisions = true,
}) {
  return (
    <>
      {showOwner ? (
        <OwnerHeroBlock
          mode="biggame"
          season={season}
          title="Owner Updates"
          version={version}
          manifest={manifest}
        />
      ) : null}

      {showDivisions ? (
        <BigGameDivisionsClient year={season} version={version} manifest={manifest} />
      ) : null}
    </>
  );
}
