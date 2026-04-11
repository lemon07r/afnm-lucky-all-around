# ModAPI Refresh

Snapshot date: `2026-04-11`

This repo was refreshed against:

- installed AFNM runtime `0.6.50`
- `afnm-types` `0.6.50`
- upstream example/docs repo `Lyeeedar/AfnmExampleMod` commit `61d0099`

## New 0.6.50 Surface

Compared with the older `0.6.47` setup, the important new ModAPI surface for this mod is:

- `window.modAPI.hooks.onGenerateExploreEvents(...)`
- `window.modAPI.hooks.onEventDropItem(...)`
- `window.modAPI.hooks.onCalculateDamage(...)`
- `window.modAPI.hooks.onLocationEnter(...)`
- `window.modAPI.hooks.onLootDrop(...)`
- `window.modAPI.hooks.onAdvanceDay(...)`
- `window.modAPI.hooks.onAdvanceMonth(...)`
- `window.modAPI.hooks.onBeforeCombat(...)`
- `window.modAPI.hooks.onReduxAction(...)`
- `window.modAPI.injectUI(...)`
- `window.modAPI.subscribe(...)`
- `window.modAPI.getGameStateSnapshot()`

## What Lucky All Around Uses

- `onGenerateExploreEvents` now arms the explore-specific patch at the exact native lifecycle point instead of relying on a DOM click listener.
- `getGameStateSnapshot()` replaces direct `window.gameStore` reads for player/location state, pity progress, and repeat-penalty fields.
- `registerOptionsUI`, `getGlobalFlags`, and `setGlobalFlag` remain the correct settings path.
- Settings now persist the mode as a numeric global flag instead of a string, but legacy string values are still read and normalized on load.

## What We Still Keep

The weighted candidate rewrite still uses the small `Array.prototype.push` patch inside `src/modContent/index.ts`.

Reason:

- in the shipped `0.6.50` runtime, `onGenerateExploreEvents` fires before the game expands weighted explore candidates into repeated `{ index, event }` entries
- repeat-penalty bookkeeping is keyed by that weighted event index (`currentLocationLastEvent` / `currentLocationLastEventCount`)
- duplicating whole events inside `onGenerateExploreEvents` would change repeat-penalty semantics, so the official hook alone is not a full replacement yet

Keep the patch boundary narrow:

- use ModAPI to arm and scope the patch
- use ModAPI snapshots for state reads
- only patch the final weighted candidate push path that ModAPI does not currently expose

## APIs We Are Not Using Yet

- `injectUI`: not needed because this mod already has a native Mod Settings panel
- `subscribe`: on-demand `getGameStateSnapshot()` reads are enough here
- `onReduxAction`: possible future escape hatch, but riskier than the current narrow weighted-slot patch for this mechanic
- non-explore hooks: out of scope for this mod unless `docs/LUCK_AUDIT.md` changes
