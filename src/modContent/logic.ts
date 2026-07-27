import type { LocationEvent, PlayerEntity, RootState } from 'afnm-types';

export type JsonRecord = Record<string, unknown>;
export type LuckMode = 'force' | 'neverWorse';

export type RuntimeConfig = {
  mode: LuckMode;
  multiplier: number;
  empoweredMultiplier: number;
  resplendentMultiplier: number;
  incandescentMultiplier: number;
  transcendentMultiplier: number;
};

export type EventAdjustment = {
  index: number;
  condition: string | null;
  rarity: string | null;
  isPity: boolean;
  baseWeight: number;
  vanillaMultiplier: number;
  configuredMultiplier: number;
  appliedMultiplier: number;
  fixedMultiplier: number;
  nativeCount: number;
  adjustedCount: number;
  fixedCount: number;
  delta: number;
};

export type AdjustmentInput = {
  config: RuntimeConfig;
  playerName: string;
  pityProgressMultiplier: number;
  lastEventIndex: number | null;
  lastEventCount: number;
  allPityConditions: string[];
};

export const DEFAULT_PITY_MULTIPLIER = 6;
export const MIN_PITY_MULTIPLIER = 1;
export const MAX_PITY_MULTIPLIER = 10;
export const MIN_RARITY_MULTIPLIER = 1;
export const MAX_RARITY_MULTIPLIER = 10;

const VANILLA_PITY_MULTIPLIERS = [10, 8, 4, 2];
const VANILLA_DEFAULT_PITY_MULTIPLIER = 1;
const RARITIES = [
  'mundane',
  'qitouched',
  'empowered',
  'resplendent',
  'incandescent',
  'transcendent',
];

export function cloneForDebug<T>(value: T): T {
  if (value == null) return value;

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // JSON cloning below is intentionally the compatibility fallback.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function clampMultiplier(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_PITY_MULTIPLIER;
  return Math.min(
    MAX_PITY_MULTIPLIER,
    Math.max(MIN_PITY_MULTIPLIER, Math.round(numericValue)),
  );
}

export function clampRarityMultiplier(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return MIN_RARITY_MULTIPLIER;
  return Math.min(
    MAX_RARITY_MULTIPLIER,
    Math.max(MIN_RARITY_MULTIPLIER, Math.round(numericValue)),
  );
}

export function normalizeMode(value: unknown): LuckMode {
  return value === 'neverWorse' || value === 1 || value === '1' || value === true
    ? 'neverWorse'
    : 'force';
}

export function serializeMode(mode: LuckMode): number {
  return mode === 'neverWorse' ? 1 : 0;
}

export function getAppliedMultiplier(
  vanillaMultiplier: number,
  config: RuntimeConfig,
): number {
  return config.mode === 'neverWorse'
    ? Math.max(vanillaMultiplier, config.multiplier)
    : config.multiplier;
}

export function getPlayerName(
  player: Pick<PlayerEntity, 'forename' | 'surname'>,
): string {
  return [player.forename, player.surname].filter(Boolean).join(' ').trim();
}

export function getRarityWeight(rarity: string | undefined): number {
  const rarityIndex = RARITIES.indexOf(rarity ?? '');
  return rarityIndex === -1 ? 1 : RARITIES.length - rarityIndex;
}

export function hashPlayerName(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}

export function buildShuffledIndexes(length: number, seed: number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  let state = seed;
  for (let index = length - 1; index > 0; index -= 1) {
    state = ((state * 1664525 + 1013904223) | 0) >>> 0;
    const swapIndex = state % (index + 1);
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes;
}

export function getVanillaPityTierWeights(length: number): number[] {
  return Array.from({ length }, (_, index) =>
    index < VANILLA_PITY_MULTIPLIERS.length
      ? VANILLA_PITY_MULTIPLIERS[index]
      : VANILLA_DEFAULT_PITY_MULTIPLIER,
  );
}

export function getVanillaPityMultiplier(
  condition: string | undefined,
  playerName: string,
  allPityConditions: string[],
): number {
  if (!condition) return VANILLA_DEFAULT_PITY_MULTIPLIER;
  const conditionIndex = allPityConditions.indexOf(condition);
  if (conditionIndex === -1) return VANILLA_DEFAULT_PITY_MULTIPLIER;

  const shuffledIndexes = buildShuffledIndexes(
    allPityConditions.length,
    hashPlayerName(playerName),
  );
  return getVanillaPityTierWeights(allPityConditions.length)[
    shuffledIndexes[conditionIndex]
  ];
}

export function getPityProgress(
  snapshot: RootState | null,
  preferredFlags?: Record<string, number>,
): number {
  const candidates = [
    preferredFlags?.globalSpecialEventPity,
    snapshot?.gameEvent?.flags?.globalSpecialEventPity,
    snapshot?.gameData?.flags?.globalSpecialEventPity,
  ];
  for (const candidate of candidates) {
    const numericValue = Number(candidate);
    if (Number.isFinite(numericValue)) return numericValue;
  }
  return 0;
}

export function buildEventAdjustment(
  event: LocationEvent,
  index: number,
  context: AdjustmentInput,
): EventAdjustment | null {
  const baseWeight = getRarityWeight(event.rarity);
  let nativeCount: number;
  let adjustedCount: number;
  let vanillaMultiplier = 1;
  let appliedMultiplier = 1;

  if (event.pity) {
    vanillaMultiplier = getVanillaPityMultiplier(
      event.condition,
      context.playerName,
      context.allPityConditions,
    );
    appliedMultiplier = getAppliedMultiplier(vanillaMultiplier, context.config);
    nativeCount = Math.ceil(
      Math.max(1, Math.ceil(baseWeight * vanillaMultiplier)) *
        context.pityProgressMultiplier,
    );
    adjustedCount = Math.ceil(
      Math.max(1, Math.ceil(baseWeight * appliedMultiplier)) *
        context.pityProgressMultiplier,
    );
  } else {
    nativeCount = baseWeight;
    const rarityMultipliers: Record<string, number> = {
      empowered: context.config.empoweredMultiplier,
      resplendent: context.config.resplendentMultiplier,
      incandescent: context.config.incandescentMultiplier,
      transcendent: context.config.transcendentMultiplier,
    };
    appliedMultiplier = rarityMultipliers[event.rarity ?? ''] ?? 1;
    if (appliedMultiplier <= 1) return null;
    adjustedCount = Math.ceil(baseWeight * appliedMultiplier);
  }

  // The runtime subtracts the repeat count after weighted-slot expansion.
  if (context.lastEventIndex === index) {
    nativeCount -= context.lastEventCount;
    adjustedCount -= context.lastEventCount;
  }
  nativeCount = Math.max(0, nativeCount);
  adjustedCount = Math.max(0, adjustedCount);

  return {
    index,
    condition: event.condition ?? null,
    rarity: event.rarity ?? null,
    isPity: Boolean(event.pity),
    baseWeight,
    vanillaMultiplier,
    configuredMultiplier: event.pity
      ? context.config.multiplier
      : appliedMultiplier,
    appliedMultiplier,
    fixedMultiplier: appliedMultiplier,
    nativeCount,
    adjustedCount,
    fixedCount: adjustedCount,
    delta: adjustedCount - nativeCount,
  };
}
