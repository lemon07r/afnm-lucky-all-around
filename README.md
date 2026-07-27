# Lucky All Around

AFNM mod that rewrites Explore pity-event exclusivity weighting with a global configurable setting. The default installed behavior is still `force 6x`.

## Settings

Open the mod settings button from the game's mod loading dialog to configure:

- `Mode`
  - `Force`: replace every pity-event tier with the selected multiplier.
  - `Never Worse`: keep any better vanilla tier and only raise lower tiers up to the selected multiplier.
- `Luck multiplier`
  - Global range from `1x` to `10x`

`Force 6x` can reduce native `8x` and `10x` pity tiers. `Never Worse 6x` avoids that and behaves like a floor instead.

## Build

```bash
bun install
bun run release:validate
```

The packaged mod zip is written to `builds/afnm-lucky-all-around.zip`.

Build metadata now resolves `gameVersion` from the installed `afnm-types` package instead of duplicating that value across multiple scripts.

## Validation

Default validation path:

```bash
bun run typecheck
bun run build
bun run runtime:oracle
bun run runtime:grep -- "onGenerateExploreEvents|getGameStateSnapshot|globalSpecialEventPity|currentLocationLastEvent"
```

Use the live debug helper after the mod loads:

```js
window.luckyAllAroundDebug.getConfig()
window.luckyAllAroundDebug.inspectLocation('Bone Pile')
window.luckyAllAroundDebug.inspectCurrentExplore()
window.luckyAllAroundDebug.getLastExplore()
window.luckyAllAroundDebug.getCompatibility()
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

## Runtime Notes

- Current target: installed AFNM runtime `0.7.6-7c586da` with `afnm-types` `0.7.6`.
- The mod uses `window.modAPI.hooks.onGenerateExploreEvents(...)` to arm the patch and `window.modAPI.getGameStateSnapshot()` for runtime state reads.
- The retained monkeypatch is the weighted candidate-slot rewrite, because the Explore hook still fires before the game's final weighted `{ index, event }` pool is built.
- The scoped mechanic is Explore pity-event exclusivity assignment. Adjacent deterministic systems are out of scope unless a fresh installed-runtime audit proves another player-name-seeded gameplay weighting path.
- Release and workshop order is documented in `docs/RELEASE_PROCESS.md`.

## My Other Mods

- [CraftBuddy](https://github.com/lemon07r/AFNM-CraftBuddy) — Live crafting optimizer overlay with AutoBuddy auto mode. ([Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3661729323))
- [ElderGPT Spirit Ring](https://github.com/lemon07r/ElderGPT-Spirit-Ring) — AI-powered contextual advisor overlay. Chat with any AI model inside the game. ([Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3701616500))

[View all my mods in my AFNM mod collection](https://steamcommunity.com/sharedfiles/filedetails/?id=3704747572)

## Make Your Own Mod

Want to build your own AFNM mod? Use the [AFNM Agent Mod Template](https://github.com/lemon07r/AfnmAgentModTemplate) — a ready-to-go scaffold with ModAPI reference docs, runtime validation scripts, Workshop packaging, and built-in support for AI coding agents.
