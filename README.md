# Lucky All Around

AFNM mod that rewrites pity-event exclusivity weighting with an adjustable global setting. The default installed behavior is still `force 6x`.

## Settings

Open the mod's settings button from the game's mod loading dialog to configure:

- `Mode`
  - `Force`: replace every pity-event tier with the selected multiplier.
  - `Never Worse`: keep any better vanilla tier and only raise lower tiers up to the selected multiplier.
- `Luck multiplier`
  - Global range from `1x` to `10x`

`Force 6x` can reduce native `8x` and `10x` pity tiers. `Never Worse 6x` avoids that and behaves like a floor instead.

## Build

```bash
bun install
bun run build
```

The packaged mod zip is written to `builds/afnm-lucky-all-around.zip`.

## Validation

Use the live debug helper after the mod loads:

```js
window.luckyAllAroundDebug.getConfig()
window.luckyAllAroundDebug.inspectLocation('Bone Pile')
window.luckyAllAroundDebug.inspectCurrentExplore()
```

The inspector reports vanilla multiplier, configured multiplier, applied multiplier, native candidate count, adjusted candidate count, and delta for each pity event. See `docs/VALIDATION.md` for the real-game workflow.

## Local Workshop Publish

This repo follows the same release order as CraftBuddy: upload to Steam Workshop locally first, then push the release tag for the GitHub Release asset.

```bash
bun run workshop:upload -- --change-note "vX.Y.Z - What changed"
```

If this mod does not have a Workshop item yet, create one intentionally:

```bash
bun run workshop:upload -- --change-note "vX.Y.Z - Initial release" --allow-create
```

Steam must be running locally, and the sibling uploader repo must exist at `../ModUploader-AFNM`.

## Runtime Parity Helpers

```bash
bun run runtime:oracle
bun run runtime:extract
bun run runtime:grep -- "window\\.gameStore|globalSpecialEventPity|pity"
```

## Notes

- Targets AFNM `0.6.47-d230b90`.
- The runtime patch leaves the native explore handler intact and rewrites pity-event candidate counts in-flight based on the saved global config.
- The only confirmed player-name-seeded gameplay weighting found in the shipped bundle is the `Explore` pity-event exclusivity assignment. Adjacent deterministic systems are documented in `docs/LUCK_AUDIT.md`.
- Settings are stored through `window.modAPI.actions.setGlobalFlag(...)`, so they apply across saves.
- Release and workshop order is documented in `docs/RELEASE_PROCESS.md`.
