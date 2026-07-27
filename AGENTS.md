# Repository Guidelines

## Project Skills

Track project skills in `.agents/skills/`. Load `lucky-explore-pity` for any Explore pity weighting, ModAPI hook, debug helper, or validation work before opening long docs.

## Documentation And Skill Stewardship

If you discover inaccurate, stale, duplicated, or misleading information in any doc or `.agents/skills/*` file while working, fix it in the same change. Agents have standing permission to edit, correct, prune, or improve docs and skills so future agents do not inherit known traps. Verify corrections against code, tests, package scripts, or the installed-runtime oracle; if something cannot be fully verified, make the uncertainty explicit instead of presenting it as fact.

## Code Search

This project is indexed with Vera. Use `vera search "query"` for semantic search and `vera grep "pattern"` for exact/regex search. Run `vera update .` after code changes.

## Project Layout

- `src/modContent/index.ts` is the small runtime bootstrap; pure weighting,
  persisted configuration, Explore interception, options UI, and diagnostics
  live in sibling modules.
- `src/mod.ts` is the webpack-style metadata entrypoint kept in sync as a fallback/reference path.
- `src/global.d.ts` documents the in-game debug API and the mod-facing `window.modAPI` surface.
- `scripts/mod-package.js` is the metadata source and resolves `gameVersion` from `afnm-types`.
- Webpack builds the modular distributable bundle; run typecheck separately.
- `scripts/zip-dist.js` writes the dist package and zip.
- `scripts/workshop-upload.ts` publishes through sibling `../ModUploader-AFNM`.
- `scripts/installed-game-runtime.js` extracts/greps the installed game bundle.
- `docs/` keeps validation and release notes. Current runtime facts belong in this file, the README, or the `lucky-explore-pity` skill, not separate historical audits.

## Commands

- `bun install`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run release:validate`
- `bun run runtime:oracle`
- `bun run runtime:extract`
- `bun run runtime:grep -- "<pattern>"`
- `bun run workshop:upload -- --change-note "vX.Y.Z - ..."`

## AFNM Mod Rules

- AFNM mods expose `window.AFNMMod.getMetadata()`.
- Prefer official ModAPI entrypoints over DOM/raw store access.
- This mod changes Explore pity-event weighting only. Do not widen scope without a fresh installed-runtime audit and a concise update to this file plus the project skill.
- `onGenerateExploreEvents` fires before final weighted pool expansion, so keep the weighted-slot patch narrow.
- Settings use numeric global flags under `luckyAllAround.mode` and `luckyAllAround.multiplier` with legacy string normalization.
- Debug helper: `window.luckyAllAroundDebug`.

## Validation And Release

Default validation:

```bash
bun run typecheck
bun run build
bun run runtime:oracle
bun run runtime:grep -- "onGenerateExploreEvents|getGameStateSnapshot|globalSpecialEventPity|currentLocationLastEvent"
```

Upload to Steam Workshop before pushing `git tag vX.Y.Z`; GitHub workflow only handles the GitHub Release asset.

Manual live UI launch is opt-in only. If required, use the native launcher outside this repo, create `disable_steam` before launch, delete it afterward, and recopy the rebuilt zip before retesting.
