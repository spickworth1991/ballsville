"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import BigGameDivisionsClient from "@/components/big-game/BigGameDivisionsClient";

export default function BigGameDynamicBlocks({ season, version = "0", manifest = null }) {
  return (
    <>
      <OwnerHeroBlock mode="biggame" season={season} title="Owner Updates" version={version} manifest={manifest} />
      <BigGameDivisionsClient year={season} version={version} manifest={manifest} />
    </>
  );
}
