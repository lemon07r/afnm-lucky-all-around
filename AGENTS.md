# Repository Guidelines

## Code Search

This project is indexed with Vera. Use `vera search "query"` for semantic code search
and `vera grep "pattern"` for regex search. Run `vera update .` after code changes.
For query tips and output format details, see the Vera skill in your skills directory.

## Project Layout

- `src/mod.ts` is the mod entry point and metadata export.
- `src/modContent/index.ts` contains the runtime patch, settings registration, and debug inspector.
- `src/global.d.ts` documents the in-game debug API and the mod-facing parts of `window.modAPI`.
- `scripts/zip-dist.js` copies `package.json` into the built mod folder and zips it into `builds/`.
- `scripts/workshop-upload.ts` publishes the built zip through the sibling `../ModUploader-AFNM` repo.
- `scripts/installed-game-runtime.js` extracts and greps the installed game bundle for parity checks.
- `.github/workflows/release.yml` builds the mod on `v*` tags and uploads the zip as a GitHub Release asset.
- `docs/RELEASE_PROCESS.md` captures the release order.
- `docs/VALIDATION.md` captures the real-game validation workflow and inspector usage.
- `docs/LUCK_AUDIT.md` captures the confirmed player-name-seeded pity logic and nearby deterministic systems that are out of scope for this mod.

## Build And Release

- `bun install`: install toolchain dependencies.
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
- Runtime integration should prefer `window.modAPI` and `window.gameStore` over brittle DOM scraping whenever possible.
- The game exposes `window.modAPI.actions.registerOptionsUI(component)`. The component is rendered as a React function component with a single `{ api }` prop and can read or write global config through `window.modAPI.actions.getGlobalFlags()` and `window.modAPI.actions.setGlobalFlag(...)`.
- This mod stores settings under `luckyAllAround.mode` and `luckyAllAround.multiplier`.
- The runtime debug helper is `window.luckyAllAroundDebug` with `getConfig()`, `inspectLocation(locationName?)`, and `inspectCurrentExplore()`.
- The installed-game luck audit currently shows one confirmed player-name-seeded gameplay path: `Explore` pity-event weighting. Do not widen the patch to other deterministic systems without updating `docs/LUCK_AUDIT.md`.
- For installed-game runtime inspection, use the sibling `/home/lamim/Development/AFNM/AFNM - CraftBuddy` repo as the oracle. Its `bun run runtime:extract` and `bun run runtime:grep -- "<pattern>"` scripts are useful when this repo needs parity checks.
- Launch the native client from the installed game directory if you need local mods to resolve correctly from `./mods/`.
