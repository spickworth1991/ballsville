// Alias route so the BIG GAME admin matches other gamemodes:
// /api/admin/big-game -> same handler as /api/admin/biggame

// Re-export the BIG GAME admin handler.
// IMPORTANT: Cloudflare Pages Functions runtime requires explicit file extensions.
export { onRequest } from "./biggame.js";
