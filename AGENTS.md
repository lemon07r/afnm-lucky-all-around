# Repository Guidelines

## Code Search

This project is indexed with Vera. Use `vera search "query"` for semantic code search
and `vera grep "pattern"` for regex search. Run `vera update .` after code changes.
For query tips and output format details, see the Vera skill in your skills directory.

## Project Layout

- `src/modContent/index.ts` is the real runtime entrypoint used by the current build pipeline. It owns the Explore patch, settings registration, and debug inspector.
- `src/mod.ts` is the webpack-style metadata entrypoint kept in sync as a fallback/reference path.
- `src/global.d.ts` documents the in-game debug API and the mod-facing part of `window.modAPI`.
- `scripts/mod-package.js` is the single source of truth for generated mod metadata and resolves `gameVersion` from `afnm-types`.
- `scripts/build-mod.js` transpiles `src/modContent/index.ts` into the distributable mod bundle.
- `scripts/zip-dist.js` writes the dist `package.json` and zips the mod into `builds/`.
- `scripts/workshop-upload.ts` publishes the built zip through the sibling `../ModUploader-AFNM` repo.
- `scripts/installed-game-runtime.js` extracts and greps the installed game bundle for parity checks.
- `.github/workflows/release.yml` builds the mod on `v*` tags and uploads the zip as a GitHub Release asset.
- `docs/VALIDATION.md` captures the real-runtime validation workflow and the non-Steam testing path.
- `docs/LUCK_AUDIT.md` captures the confirmed player-name-seeded pity logic and the shipped Explore hook order.
- `docs/MODAPI_REFRESH.md` captures the `0.6.49` ModAPI audit and what this repo does and does not replace with official APIs.
- `docs/RELEASE_PROCESS.md` captures the release order.

## Build And Release

- `bun install`: install toolchain dependencies.
- `bun run typecheck`: run TypeScript validation. Use this before builds because `scripts/build-mod.js` is a fast transpile path, not a full typecheck.
- `bun run build`: build `dist/afnm-lucky-all-around/mod.js` and package `builds/afnm-lucky-all-around.zip`.
- `bun run workshop:upload -- --change-note "vX.Y.Z - ..."`: upload the current build to Steam Workshop through `../ModUploader-AFNM`.
- `bun run runtime:oracle`: print the installed-game runtime summary.
- `bun run runtime:extract`: print the cached extracted runtime path.
- `bun run runtime:grep -- "<pattern>"`: grep the extracted installed runtime.
- Upload to Steam Workshop before pushing `git tag vX.Y.Z`; the GitHub workflow only handles the GitHub Release asset.

## Release Order

- Build and validate locally.
- Upload the built zip to Steam Workshop.
- Push the release commit.
- Push the release tag to trigger `.github/workflows/release.yml`.

## AFNM Mod Notes

- AFNM mods load by exposing `window.AFNMMod` with a `getMetadata()` function.
- Prefer official ModAPI entrypoints over DOM scraping or raw store access:
  - `window.modAPI.hooks.onGenerateExploreEvents(...)`
  - `window.modAPI.getGameStateSnapshot()`
  - `window.modAPI.actions.registerOptionsUI(...)`
  - `window.modAPI.actions.getGlobalFlags()` / `setGlobalFlag(...)`
- As of `2026-04-04`, the shipped `0.6.49-727424c` runtime calls `onGenerateExploreEvents` before the final weighted `{ index, event }` pool is built. This mod therefore keeps a narrow weighted-slot patch, but the hook is now the official arm point.
- Do not reintroduce DOM click listeners, React fiber scraping, or `window.gameStore` reads for this mod unless the current ModAPI path regresses in the shipped runtime.
- This mod stores settings under `luckyAllAround.mode` and `luckyAllAround.multiplier`. The current storage format writes numeric global flags; legacy string values are still normalized on load for compatibility.
- The runtime debug helper is `window.luckyAllAroundDebug` with `getConfig()`, `inspectLocation(locationName?)`, and `inspectCurrentExplore()`.
- The installed-game luck audit currently shows one confirmed player-name-seeded gameplay path: `Explore` pity-event weighting. Do not widen the patch to other deterministic systems without updating `docs/LUCK_AUDIT.md`.
- For installed-game runtime inspection, use the local oracle first. The sibling `/home/lamim/Development/AFNM/AFNM - CraftBuddy` repo remains a useful reference for broader testing patterns and docs structure.
- Default testing path is the installed-runtime oracle. Manual live UI launch is opt-in only and should not go through Steam.
- If manual live UI launch is explicitly required, the native launcher is:
  - `"/home/lamim/.local/share/Steam/steamapps/common/Ascend From Nine Mountains/launch-native.sh"`
  - create a `disable_steam` sentinel file beside the binary first
  - **CRITICAL:** When finished testing, delete the `disable_steam` file so the game can communicate with Steam again. If left behind, workshop mods will not load.
  - launch from the installed game directory or another non-repo working directory so the app does not write its own `./settings.json` here
  - after a new build or release bump, recopy `builds/afnm-lucky-all-around.zip` into the installed game's `mods/` directory before retesting or the runtime helper may still show the older installed version
  - if the title-screen Mod Manager is open, press its own `CONTINUE` button to apply mod enable/disable state before loading a save
