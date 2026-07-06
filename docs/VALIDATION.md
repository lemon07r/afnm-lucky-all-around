# Validation

Validation snapshot: `2026-07-06`

Default parity target:

- installed runtime `0.7.1-7117b38`
- `afnm-types` `0.7.0`

## Default Validation Flow

For `src/modContent/index.ts` and other runtime-sensitive work, the default validation path is the installed-runtime oracle below, not launching the live UI.

1. Run local checks:
   - `bun run typecheck`
   - `bun run build`
2. Verify the installed runtime surface:
   - `bun run runtime:oracle`
   - `bun run runtime:grep -- "onGenerateExploreEvents|getGameStateSnapshot|globalSpecialEventPity|currentLocationLastEvent"`
3. If you need the extracted bundle path:
   - `bun run runtime:extract`

This is the preferred path because it validates against the real shipped code without launching Steam or the desktop client.

## Installed Runtime Oracle

`bun run runtime:oracle` now reports:

- installed game version and extracted runtime path
- Steam restart behavior and `disable_steam` sentinel support
- ModAPI exposures relevant to this repo:
  - `registerOptionsUI`
  - `onGenerateExploreEvents`
  - `onLocationEnter`
  - `onReduxAction`
  - `injectUI`
  - `subscribe`
  - `getGameStateSnapshot`

When docs, types, and live behavior disagree, prefer the installed runtime.

## Build And Install

1. `bun run typecheck`
2. `bun run build`
3. Copy `builds/afnm-lucky-all-around.zip` into the installed game's `mods/` directory.

   Default local install path:

   ```text
   /home/lamim/.local/share/Steam/steamapps/common/Ascend From Nine Mountains/mods/
   ```

4. If the live client still reports an older Lucky All Around version after a rebuild, remove the older local zip from the installed `mods/` directory and copy the new one again before relaunching.

## Optional Manual Live UI Verification

Live UI launch is manual and opt-in only.

Reasons:

- direct app launch is disruptive on the desktop
- the installed app restarts through Steam by default unless a `disable_steam` sentinel file exists beside the binary
- default validation for this repo does not need the live UI

If manual launch is explicitly needed later:

1. create an empty `disable_steam` file next to `AscendFromNineMountains`
2. launch from the installed game directory, not from this repo
3. use the native launcher:

   ```bash
   "/home/lamim/.local/share/Steam/steamapps/common/Ascend From Nine Mountains/launch-native.sh"
   ```

4. keep the working directory outside this repo so the game does not write its own `./settings.json` here
5. the title-screen Mod Manager does not apply its enabled/disabled state until you press its own `CONTINUE` button
6. after the Mod Manager apply step completes, use the save-level `CONTINUE` button to load the intended character save
7. **CRITICAL:** When finished testing, delete the `disable_steam` file so the game can communicate with Steam again. If left behind, workshop mods will not load.

Do not use this path for routine automated validation.

## Latest Manual Live UI Pass

Manual live validation snapshot: `2026-04-06`

Evidence captured against the native non-Steam launcher:

- the game loaded through `launch-native.sh --remote-debugging-port=9222`
- the title-screen Mod Manager applied the local zip only after its own `CONTINUE` button was pressed
- the live log then showed:
  - `Loading mod afnm-lucky-all-around`
  - `[LuckyAllAround] Installed ModAPI explore hook with weighted candidate patch`
  - `Mod loaded successfully!`
- in the live renderer:
  - `window.luckyAllAroundDebug` existed
  - `window.__luckyAllAroundInstalled === true`
  - `window.modAPI.actions.getGlobalFlags()` exposed both legacy and normalized `luckyAllAround*` keys
- the Han Yu save loaded at `Crossroads`
- a real `EXPLORE (1 DAY)` click completed successfully and `window.luckyAllAroundDebug.getLastExplore()` recorded:
  - `status: "completed"`
  - `trigger: "onGenerateExploreEvents"`
  - `locationName: "Crossroads"`

Crossroads itself is not a useful pity-adjustment target for this save because its current candidate pool reports `adjustmentCount: 0`. Use the live debug inspector to choose a pity location before treating a manual UI pass as multiplier-behavior validation.

Second live pass on the same save:

- the game state was restored to pre-explore `Bone Pile`
- `window.luckyAllAroundDebug.inspectLocation('Bone Pile')` reported one real pity adjustment:
  - `condition: "fallenSoulflameRetrieved == 0"`
  - `vanillaMultiplier: 4`
  - `configuredMultiplier: 6`
  - `appliedMultiplier: 6`
  - `nativeCount: 20`
  - `adjustedCount: 30`
  - `delta: 10`
- a real `EXPLORE (1 DAY)` click completed without a crash on retry
- the event screen opened on the Fallen Soulflame event text
- `window.luckyAllAroundDebug.getLastExplore()` then recorded:
  - `status: "completed"`
  - `trigger: "onGenerateExploreEvents"`
  - `locationName: "Bone Pile"`
  - `observedNativePushes: 20`
  - `observedAdjustedPushes: 30`

This is the current end-to-end proof point for live pity-weight behavior on the `2026-04-06` Han Yu save.

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
- `trigger`: whether the latest arm/complete cycle came through `onGenerateExploreEvents`

## Real-Game Notes

- `Force 6x` is not a universal buff. It lowers native `8x` and `10x` pity tiers to `6x`.
- `Never Worse 6x` behaves like a floor and avoids reducing better vanilla tiers.
- `Ancestral Barrows`, `The Ascent`, `Bifang Crane Corpse`, `Shanlu Foothills`, and `Bone Pile` currently inspect as pity-bearing targets in the live debug helper on the `2026-04-06` Han Yu save.
- Hand-editing a save's `location.current` is not enough to synthesize a trustworthy `Explore` state. For end-to-end button validation, use a save that already lives in a real combat location with pity events.
- `Heian Forest` was a bad target in earlier validation because the loaded save had `adjustmentCount: 0` there.
- As of `2026-04-04`, the shipped Explore hook fires before weighted candidate expansion, so this mod still keeps a narrow weighted-slot patch after the hook arms it.
