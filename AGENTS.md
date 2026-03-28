# Repository Guidelines

## Code Search

This project is indexed with Vera. Use `vera search "query"` for semantic code search
and `vera grep "pattern"` for regex search. Run `vera update .` after code changes.
For query tips and output format details, see the Vera skill in your skills directory.

## Project Layout

- `src/mod.ts` is the mod entry point and metadata export.
- `src/modContent/index.ts` contains the runtime patch for exploration luck.
- `scripts/zip-dist.js` copies `package.json` into the built mod folder and zips it into `builds/`.
- `.github/workflows/release.yml` builds the mod on `v*` tags and uploads the zip as a GitHub Release asset.

## Build And Release

- `bun install`: install toolchain dependencies.
- `bun run build`: build `dist/afnm-lucky-all-around-x6/mod.js` and package `builds/afnm-lucky-all-around-x6.zip`.
- Push `git tag vX.Y.Z` to trigger the GitHub release workflow.

## AFNM Mod Notes

- AFNM mods load by exposing `window.AFNMMod` with a `getMetadata()` function.
- Runtime integration should prefer `window.modAPI` and `window.gameStore` over brittle DOM scraping whenever possible.
- For installed-game runtime inspection, use the sibling `/home/lamim/Development/AFNM/AFNM - CraftBuddy` repo as the oracle. Its `bun run runtime:extract` and `bun run runtime:grep -- "<pattern>"` scripts are useful when this repo needs parity checks.
