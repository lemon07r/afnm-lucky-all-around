import {
  clampMultiplier,
  clampRarityMultiplier,
  normalizeMode,
  serializeMode,
  type RuntimeConfig,
} from './logic';

export const FLAG_KEYS = {
  mode: 'luckyAllAround.mode',
  multiplier: 'luckyAllAround.multiplier',
  empoweredMultiplier: 'luckyAllAround.empoweredMultiplier',
  resplendentMultiplier: 'luckyAllAround.resplendentMultiplier',
  incandescentMultiplier: 'luckyAllAround.incandescentMultiplier',
  transcendentMultiplier: 'luckyAllAround.transcendentMultiplier',
} as const;

const LEGACY_MODE_FLAG_KEY = 'luckyAllAroundX6.mode';
const LEGACY_MULTIPLIER_FLAG_KEY = 'luckyAllAroundX6.multiplier';

export function getGlobalFlags(): Record<string, unknown> {
  return window.modAPI?.actions?.getGlobalFlags?.() ?? {};
}

export function getRuntimeConfigFromFlags(
  flags: Record<string, unknown>,
): RuntimeConfig {
  return {
    mode: normalizeMode(flags[FLAG_KEYS.mode] ?? flags[LEGACY_MODE_FLAG_KEY]),
    multiplier: clampMultiplier(
      flags[FLAG_KEYS.multiplier] ?? flags[LEGACY_MULTIPLIER_FLAG_KEY],
    ),
    empoweredMultiplier: clampRarityMultiplier(
      flags[FLAG_KEYS.empoweredMultiplier],
    ),
    resplendentMultiplier: clampRarityMultiplier(
      flags[FLAG_KEYS.resplendentMultiplier],
    ),
    incandescentMultiplier: clampRarityMultiplier(
      flags[FLAG_KEYS.incandescentMultiplier],
    ),
    transcendentMultiplier: clampRarityMultiplier(
      flags[FLAG_KEYS.transcendentMultiplier],
    ),
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return getRuntimeConfigFromFlags(getGlobalFlags());
}

export function persistRuntimeConfig(config: RuntimeConfig): void {
  window.modAPI?.actions?.setGlobalFlag?.(
    FLAG_KEYS.mode,
    serializeMode(config.mode),
  );
  window.modAPI?.actions?.setGlobalFlag?.(
    FLAG_KEYS.multiplier,
    config.multiplier,
  );
  window.modAPI?.actions?.setGlobalFlag?.(
    FLAG_KEYS.empoweredMultiplier,
    config.empoweredMultiplier,
  );
  window.modAPI?.actions?.setGlobalFlag?.(
    FLAG_KEYS.resplendentMultiplier,
    config.resplendentMultiplier,
  );
  window.modAPI?.actions?.setGlobalFlag?.(
    FLAG_KEYS.incandescentMultiplier,
    config.incandescentMultiplier,
  );
  window.modAPI?.actions?.setGlobalFlag?.(
    FLAG_KEYS.transcendentMultiplier,
    config.transcendentMultiplier,
  );
}

export function ensureNormalizedRuntimeConfig(): void {
  const flags = getGlobalFlags();
  const normalized = getRuntimeConfigFromFlags(flags);
  const needsWrite =
    flags[FLAG_KEYS.mode] !== serializeMode(normalized.mode) ||
    flags[FLAG_KEYS.multiplier] !== normalized.multiplier ||
    flags[FLAG_KEYS.empoweredMultiplier] !== normalized.empoweredMultiplier ||
    flags[FLAG_KEYS.resplendentMultiplier] !== normalized.resplendentMultiplier ||
    flags[FLAG_KEYS.incandescentMultiplier] !==
      normalized.incandescentMultiplier ||
    flags[FLAG_KEYS.transcendentMultiplier] !==
      normalized.transcendentMultiplier ||
    flags[LEGACY_MODE_FLAG_KEY] !== undefined ||
    flags[LEGACY_MULTIPLIER_FLAG_KEY] !== undefined;
  if (needsWrite) persistRuntimeConfig(normalized);
}

export function updateRuntimeConfig(
  partial: Partial<RuntimeConfig>,
): RuntimeConfig {
  const next = { ...getRuntimeConfig(), ...partial };
  const normalized: RuntimeConfig = {
    mode: normalizeMode(next.mode),
    multiplier: clampMultiplier(next.multiplier),
    empoweredMultiplier: clampRarityMultiplier(next.empoweredMultiplier),
    resplendentMultiplier: clampRarityMultiplier(next.resplendentMultiplier),
    incandescentMultiplier: clampRarityMultiplier(next.incandescentMultiplier),
    transcendentMultiplier: clampRarityMultiplier(next.transcendentMultiplier),
  };
  persistRuntimeConfig(normalized);
  return normalized;
}
