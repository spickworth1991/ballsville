"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import GauntletLegionsClient from "@/components/gauntlet/GauntletLegionsClient";

/**
 * Render-partial so the Gauntlet page can keep its original layout:
 * - Owner Updates stays near the hero.
 * - Legions directory stays in the dedicated "The Legions" section.
 */
export default function GauntletDynamicBlocks({
  season,
  version = "0",
  manifest = null,
  showOwner = true,
  showLegions = true,
  embeddedLegions = false,
}) {
  return (
    <>
      {showOwner ? (
        <OwnerHeroBlock
          mode="gauntlet"
          season={season}
          title="Owner Updates"
          version={version}
          manifest={manifest}
        />
      ) : null}

      {showLegions ? (
        <GauntletLegionsClient
          embedded={embeddedLegions}
          season={season}
          version={version}
          manifest={manifest}
        />
      ) : null}
    </>
  );
}
