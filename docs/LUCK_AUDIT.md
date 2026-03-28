# Luck Audit

This mod only patches the shipped `Explore` pity-event weighting path.

## Confirmed Player-Name Seeded Logic

The installed game bundle contains one confirmed gameplay path that derives a deterministic weighting from the player's full name:

- `Explore` pity-event exclusivity tiers
  - The native odds tiers are `[10, 8, 4, 2]` with a fallback of `1`.
  - All pity event conditions across locations are collected into one sorted list.
  - The full player name is built as `"{forename} {surname}"`.
  - That full name is hashed and used to shuffle the pity-condition index list.
  - Each pity event receives its multiplier from the shuffled tier assignment.
  - `globalSpecialEventPity` is then applied on top as the separate progressive pity multiplier.

That is the mechanic this mod rewrites.

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

After beautifying and searching the shipped bundle, no other confirmed gameplay weighting path tied to the player's name was found outside the `Explore` pity-event assignment above.

If this conclusion changes, update this file and the mod scope note in `README.md`.
