# Luck Audit

Audit snapshot: `2026-04-04`

This mod only patches the shipped `Explore` pity-event weighting path.

## Confirmed Player-Name Seeded Logic

The installed `0.6.49-727424c` game bundle contains one confirmed gameplay path that derives a deterministic weighting from the player's full name:

- `Explore` pity-event exclusivity tiers
  - the native odds tiers are `[10, 8, 4, 2]` with a fallback of `1`
  - all pity event conditions across locations are collected into one sorted list
  - the full player name is built as `"{forename} {surname}"`
  - that full name is hashed and used to shuffle the pity-condition index list
  - each pity event receives its multiplier from the shuffled tier assignment
  - `globalSpecialEventPity` is then applied on top as the separate progressive pity multiplier

That is the mechanic this mod rewrites.

## 0.6.49 Explore Hook Order

The shipped `0.6.49` runtime now exposes `window.modAPI.hooks.onGenerateExploreEvents(...)`, but the installed bundle shows this order:

1. start from `location.events`
2. run `onGenerateExploreEvents`
3. filter by conditions and cooldowns
4. expand each surviving event into weighted repeated `{ index, event }` entries
5. apply `currentLocationLastEvent` / `currentLocationLastEventCount`
6. choose one weighted entry

That means the hook is useful for arming this mod at the right lifecycle point, but it still does not expose the final weighted pool directly.

Because repeat-penalty bookkeeping is keyed by the weighted event index, duplicating whole events inside the hook would change native repeat behavior. That is why the mod still keeps a narrow weighted-slot patch after the hook arms it.

## Adjacent Deterministic Systems

These systems are deterministic or seeded, but they are not the same player-name-based pity weighting:

- NPC trade/exchange requests are seeded by `character name + month`.
- Guild task board offerings are seeded by `year + month`.
- Mystical region progression content is seeded by `month + day + region key + progress index`.
- Mine chamber generation is seeded by `tile coordinates + mine seed`.
- Fallen star filler character selection is seeded by `current location`.
- Some item visual variants are seeded by `item name + quality tier`.
- Several UI animation timings and layout flourishes are seeded by image or display name values.

## Conclusion

After searching the shipped bundle and the refreshed `afnm-types` / ExampleMod docs, no other confirmed gameplay weighting path tied to the player's name was found outside the `Explore` pity-event assignment above.

If this conclusion changes, update this file, `docs/MODAPI_REFRESH.md`, and the mod scope note in `README.md`.
