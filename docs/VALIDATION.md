# Validation

## Build And Install

1. `bun run build`
2. Copy `builds/afnm-lucky-all-around.zip` into the installed game's `mods/` directory.
3. Launch the native client from the installed game directory so relative mod resolution still works.

## In-Game Settings

- Open the mod loading dialog.
- Use the settings button beside `afnm-lucky-all-around`.
- Choose:
  - `Force`: exact replacement with the chosen multiplier.
  - `Never Worse`: floor behavior that preserves any better vanilla tier.
- Set the slider between `1x` and `10x`.

Settings are stored globally through ModAPI global flags, so they apply across saves.

## Live Inspector

After the mod is loaded, use the runtime helper in the real client:

```js
window.luckyAllAroundDebug.getConfig()
window.luckyAllAroundDebug.inspectLocation('Bone Pile')
window.luckyAllAroundDebug.inspectCurrentExplore()
window.luckyAllAroundDebug.getLastExplore()
```

Important fields:

- `config`: current saved mode and multiplier
- `vanillaMultiplier`: the unmodded deterministic tier for that pity event
- `configuredMultiplier`: the raw slider value
- `appliedMultiplier`: the multiplier actually used after mode rules
- `nativeCount`: vanilla candidate count after pity progression and repeat penalty
- `adjustedCount`: modded candidate count after the same modifiers
- `delta`: `adjustedCount - nativeCount`

## Real-Game Notes

- `Force 6x` is not a universal buff. It lowers native `8x` and `10x` pity tiers to `6x`.
- `Never Worse 6x` behaves like a floor and avoids reducing better vanilla tiers.
- Hand-editing a save's `location.current` is not enough to synthesize a trustworthy `Explore` state. For end-to-end button validation, use a save that already lives in a real combat location with pity events.
- `Heian Forest` was a bad target in earlier validation because the loaded save had `adjustmentCount: 0` there.
