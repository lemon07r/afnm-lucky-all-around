---
name: lucky-explore-pity
description: Lucky All Around AFNM skill for Explore pity-event luck weighting. Activate for onGenerateExploreEvents, weighted-slot patching, global luck settings, runtime audits, validation, release notes, or any src/modContent/index.ts change.
---

# Lucky Explore Pity

Lucky All Around only changes AFNM Explore pity-event weighting. Keep the patch narrow and verified against the installed runtime.

## Activate When

- Editing `src/modContent/index.ts`, mod settings, or debug helpers
- Working with `onGenerateExploreEvents`
- Investigating `globalSpecialEventPity`, `currentLocationLastEvent`, or weighted candidate pools
- Updating validation or release flow

## Current Runtime Facts

- Installed AFNM `0.7.1-7117b38` calls `onGenerateExploreEvents` before final weighted `{ index, event }` entries are expanded.
- Repeat penalty bookkeeping is keyed by weighted event index via `currentLocationLastEvent` / `currentLocationLastEventCount`.
- Duplicating whole events in the hook would change native repeat behavior.
- The mod therefore uses ModAPI to arm/scope the behavior and keeps a narrow `Array.prototype.push` weighted-slot patch for the missing final-pool hook.

## Source Priority

1. `window.modAPI.hooks.onGenerateExploreEvents(...)` to arm the Explore lifecycle point.
2. `window.modAPI.getGameStateSnapshot()` for player/location/pity/repeat state.
3. `registerOptionsUI`, `getGlobalFlags`, `setGlobalFlag` for settings.
4. Avoid DOM listeners, React fiber scraping, and `window.gameStore` reads unless the current ModAPI path regresses.

## Scope Rules

- Do not widen this mod to unrelated deterministic systems unless a fresh installed-runtime audit proves a player-name-seeded gameplay path and active docs/skills are updated.
- Preserve numeric global flags for `luckyAllAround.mode` and `luckyAllAround.multiplier`; keep legacy string normalization.
- Runtime debug surface is `window.luckyAllAroundDebug` with `getConfig()`, `getCompatibility()`, `inspectLocation(locationName?)`, `inspectCurrentExplore()`, and last-explore inspection.

## Documentation And Skill Stewardship

If `docs/VALIDATION.md`, this skill, or any other project doc/skill is wrong or stale, update it immediately while the context is fresh. Do not leave known inaccurate hook-order, runtime-version, debug-helper, or release-flow guidance for later agents.

## Validation

```bash
bun run typecheck
bun run build
bun run runtime:oracle
bun run runtime:grep -- "onGenerateExploreEvents|getGameStateSnapshot|globalSpecialEventPity|currentLocationLastEvent"
```

Manual live UI is opt-in only; if used, recopy the rebuilt zip, launch outside the repo with `disable_steam`, and delete the sentinel afterward.

## Gotchas

1. **Hook order is pre-expansion**: the official hook alone cannot set final weighted odds.
2. **Repeat penalty semantics are fragile**: avoid changing weighted event indexes unless intentionally updating native behavior.
3. **Force mode can lower high vanilla tiers**: `Force 6x` lowers native `8x`/`10x`; `Never Worse` is the floor mode.
4. **One confirmed name-seeded gameplay path**: current audit only supports Explore pity weighting.

## References

- `docs/VALIDATION.md`
- `src/modContent/index.ts`
