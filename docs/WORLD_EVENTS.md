# World Events & On-Enter Modifiers

This document contains research notes for future implementation of world map event modifiers and on-enter event manipulations.

## EventTrigger.tsx
The game's developer pointed out that `components/game/EventTrigger.tsx` handles location-based events. This is a React component in the game's internal source code that evaluates if an event should trigger upon entering a location or performing an action.

### Limitations
Because `EventTrigger` is a compiled React component inside the Electron app (`Game.js`), we do not have direct access to alter its internal dice rolls or `Math.random` checks via the standard `afnm-types` Mod API.

### Potential Future Hooks
Currently, the Mod API exposes:
- `onGenerateExploreEvents` (which we use for the Explore pity and rarity systems)
- `startEvent` (to manually trigger events)
- Assorted post-completion hooks (`onCompleteCombat`, `onCompleteCrafting`, etc.)

To implement a "Luck" modifier that affects World Events (events that trigger on entering a location) or Gathering chances, we would need to explore one of these paths:
1. **Requesting a New Hook:** Ask the developer to expose an `onEvaluateLocationEvent` or `onCheckTriggerChance` hook that allows mods to intercept and multiply the `triggerChance` property before `EventTrigger.tsx` rolls the dice.
2. **State Manipulation:** Periodically scanning the `RootState` for `mapEvents` or `gatheringEvent` properties on locations and forcefully overwriting their `triggerChance` properties on load. (This might be risky if the game expects these to remain pure definitions).
3. **Event Replacement:** Using the mod API's `addMapEventsToLocation` or similar functions to completely replace vanilla map events with cloned versions that have a higher `triggerChance`.

Until an explicit hook is provided for World Map events, the current approach of boosting rarity weights within the `Explore` pool is the most effective and stable way to implement a global "Luck" multiplier.
