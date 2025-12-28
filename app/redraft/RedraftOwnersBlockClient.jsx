"use client";

import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import RedraftLeaguesClient from "./RedraftLeaguesClient";
import { CURRENT_SEASON } from "@/lib/season";

export default function RedraftDynamicBlocks({ version = "0", manifest = null }) {
  return (
    <>
      <OwnerHeroBlock
        mode="redraft"
        season={CURRENT_SEASON}
        title="Owner Updates"
        version={version}
        manifest={manifest}
      />

    </>
  );
}
