"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import GauntletLegionsClient from "@/components/gauntlet/GauntletLegionsClient";

export default function GauntletDynamicBlocks({ season, version = "0", manifest = null }) {
  return (
    <>
      <OwnerHeroBlock mode="gauntlet" season={season} title="Owner Updates" version={version} manifest={manifest} />
      <GauntletLegionsClient embedded season={season} version={version} manifest={manifest} />
    </>
  );
}
