# Mod API Feature Request: Dynamic Trigger Chance Hook

**Status: ARCHIVED FOR THIS REPO**
*Note: AFNM `0.6.50` did not add the requested trigger-chance hook. This document is retained for historical context, but Lucky All Around no longer depends on it because the mod scope narrowed to Explore weighting through `onGenerateExploreEvents`.*

**Context:** The developer mentioned looking into `components/game/EventTrigger.tsx` to handle location-based event modifiers.

## The Goal
We are building a "Luck" mod that scales the chances of encountering rare events and items. We successfully hooked into `onGenerateExploreEvents` to scale rarity weights for Explore events. 

However, we also want to apply our dynamic luck multipliers to **Map Events** and **Gathering Events**, which rely on a static `triggerChance` property. Modifying `gameData` directly at runtime to change `triggerChance` is warned against and does not handle in-game dynamic configuration changes cleanly.

## The Request
Please expose a new Mod API hook that intercepts the `triggerChance` calculation right before the random roll occurs in `EventTrigger.tsx` (or the relevant event evaluation logic). 

This allows mods to cleanly and dynamically apply luck multipliers to location events without mutating static definitions.

---

### Implementation Instructions for AI Assistant

**1. Add the hook definition to the ModAPI types (e.g., in `afnm-types/mod.d.ts` / `modAPI.ts`):**

```typescript
/**
 * Hook to intercept and modify the base trigger chance of an event.
 * Called whenever the game evaluates if an event should fire (e.g., in EventTrigger.tsx).
 * 
 * @param chance - The original trigger chance (e.g., 0.15 for 15%).
 * @param eventSource - The type or source of the event (e.g., 'mapEvent', 'gatheringEvent').
 * @param locationName - The location where the event is triggering.
 * @param gameFlags - Current global game flags.
 * @returns The modified trigger chance.
 */
onCalculateTriggerChance: (
  chance: number,
  eventSource: 'mapEvent' | 'gatheringEvent' | string,
  locationName: string,
  gameFlags: Record<string, number>
) => number;
```

**2. Inject the hook in `EventTrigger.tsx` (or the evaluation slice):**

Right before evaluating the event trigger condition (e.g., `Math.random() < triggerChance`), run the base `triggerChance` through the hook pipeline.

```tsx
// Inside components/game/EventTrigger.tsx:

// Base chance from the event definition
let currentChance = event.triggerChance ?? 1.0;

// Intercept with ModAPI
if (window.modAPI?.hooks?.onCalculateTriggerChance) {
  // Assuming access to current Redux state/flags and location
  const flags = globalFlags; 
  const locationName = currentLocation;
  
  currentChance = window.modAPI.hooks.onCalculateTriggerChance(
    currentChance,
    'mapEvent', // or 'gatheringEvent' based on the prop/context
    locationName,
    flags
  );
}

// Proceed with the actual RNG check
if (Math.random() < currentChance) {
  // ... trigger the event ...
}
```

### Why this is the optimal solution:
- **Non-destructive:** Prevents mods from mutating the `gameData` state directly.
- **Dynamic Calculation:** Mods can pull their real-time configuration values (e.g. a "2x Luck" slider) and apply them on the fly.
- **Targeted:** The `eventSource` string allows mods to specifically target 'mapEvents' or 'gatheringEvents' without breaking other systems.
