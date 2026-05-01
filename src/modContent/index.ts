import type {
  GameLocation,
  LocationEvent,
  ModOptionsFC,
  PlayerEntity,
  RootState,
} from 'afnm-types';

type JsonRecord = Record<string, unknown>;

type LuckMode = 'force' | 'neverWorse';

type RuntimeConfig = {
  mode: LuckMode;
  multiplier: number;
  empoweredMultiplier: number;
  resplendentMultiplier: number;
  incandescentMultiplier: number;
  transcendentMultiplier: number;
};

type EventAdjustment = {
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

type ExplorePatchContext = {
  startedAt: string;
  playerName: string;
  locationName: string;
  pityProgress: number;
  pityProgressMultiplier: number;
  lastEventIndex: number | null;
  lastEventCount: number;
  config: RuntimeConfig;
  adjustments: EventAdjustment[];
  adjustmentsByKey: Map<string, EventAdjustment>;
  pushTrackingByKey: Map<string, { nativeSeen: number; adjustedPushed: number }>;
};

const MOD_TAG = '[LuckyAllAround]';
const DEFAULT_PITY_MULTIPLIER = 6;
const MIN_PITY_MULTIPLIER = 1;
const MAX_PITY_MULTIPLIER = 10;
const MIN_RARITY_MULTIPLIER = 1;
const MAX_RARITY_MULTIPLIER = 10;

const MODE_FLAG_KEY = 'luckyAllAround.mode';
const MULTIPLIER_FLAG_KEY = 'luckyAllAround.multiplier';
const EMPOWERED_MULTIPLIER_FLAG_KEY = 'luckyAllAround.empoweredMultiplier';
const RESPLENDENT_MULTIPLIER_FLAG_KEY = 'luckyAllAround.resplendentMultiplier';
const INCANDESCENT_MULTIPLIER_FLAG_KEY = 'luckyAllAround.incandescentMultiplier';
const TRANSCENDENT_MULTIPLIER_FLAG_KEY = 'luckyAllAround.transcendentMultiplier';

const LEGACY_MODE_FLAG_KEY = 'luckyAllAroundX6.mode';
const LEGACY_MULTIPLIER_FLAG_KEY = 'luckyAllAroundX6.multiplier';

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

const originalArrayPush = Array.prototype.push;

let activeExplorePatch: ExplorePatchContext | null = null;
let lastExploreDiagnostics: JsonRecord | null = null;
let lastLootDropDiagnostics: JsonRecord | null = null;

function log(message: string, ...args: unknown[]) {
  console.log(MOD_TAG, message, ...args);
}

function getLocations(): Record<string, GameLocation> {
  return (window.modAPI?.gameData?.locations ?? {}) as Record<string, GameLocation>;
}

// As of 0.6.50 getGameStateSnapshot is more reliable across save
// file loads and switches; no gameStore fallback is needed.
function getSnapshot(): RootState | null {
  return window.modAPI?.getGameStateSnapshot?.() ?? null;
}

function getGlobalFlags(): Record<string, unknown> {
  return window.modAPI?.actions?.getGlobalFlags?.() ?? {};
}

function cloneForDebug<T>(value: T): T {
  if (value == null) {
    return value;
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON cloning.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function clampMultiplier(value: unknown): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_PITY_MULTIPLIER;
  }

  return Math.min(
    MAX_PITY_MULTIPLIER,
    Math.max(MIN_PITY_MULTIPLIER, Math.round(numericValue)),
  );
}

function clampRarityMultiplier(value: unknown): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return MIN_RARITY_MULTIPLIER;
  }

  return Math.min(
    MAX_RARITY_MULTIPLIER,
    Math.max(MIN_RARITY_MULTIPLIER, Math.round(numericValue)),
  );
}

function normalizeMode(value: unknown): LuckMode {
  return value === 'neverWorse' || value === 1 || value === '1' || value === true
    ? 'neverWorse'
    : 'force';
}

function serializeMode(mode: LuckMode): number {
  return mode === 'neverWorse' ? 1 : 0;
}

function getRuntimeConfigFromFlags(flags: Record<string, unknown>): RuntimeConfig {
  return {
    mode: normalizeMode(flags[MODE_FLAG_KEY] ?? flags[LEGACY_MODE_FLAG_KEY]),
    multiplier: clampMultiplier(
      flags[MULTIPLIER_FLAG_KEY] ?? flags[LEGACY_MULTIPLIER_FLAG_KEY],
    ),
    empoweredMultiplier: clampRarityMultiplier(flags[EMPOWERED_MULTIPLIER_FLAG_KEY]),
    resplendentMultiplier: clampRarityMultiplier(flags[RESPLENDENT_MULTIPLIER_FLAG_KEY]),
    incandescentMultiplier: clampRarityMultiplier(flags[INCANDESCENT_MULTIPLIER_FLAG_KEY]),
    transcendentMultiplier: clampRarityMultiplier(flags[TRANSCENDENT_MULTIPLIER_FLAG_KEY]),
  };
}

function getRuntimeConfig(): RuntimeConfig {
  return getRuntimeConfigFromFlags(getGlobalFlags());
}

function persistRuntimeConfig(config: RuntimeConfig) {
  window.modAPI?.actions?.setGlobalFlag?.(MODE_FLAG_KEY, serializeMode(config.mode));
  window.modAPI?.actions?.setGlobalFlag?.(MULTIPLIER_FLAG_KEY, config.multiplier);
  window.modAPI?.actions?.setGlobalFlag?.(EMPOWERED_MULTIPLIER_FLAG_KEY, config.empoweredMultiplier);
  window.modAPI?.actions?.setGlobalFlag?.(RESPLENDENT_MULTIPLIER_FLAG_KEY, config.resplendentMultiplier);
  window.modAPI?.actions?.setGlobalFlag?.(INCANDESCENT_MULTIPLIER_FLAG_KEY, config.incandescentMultiplier);
  window.modAPI?.actions?.setGlobalFlag?.(TRANSCENDENT_MULTIPLIER_FLAG_KEY, config.transcendentMultiplier);
}

function ensureNormalizedRuntimeConfig() {
  const flags = getGlobalFlags();
  const normalizedConfig = getRuntimeConfigFromFlags(flags);
  const needsModeWrite = flags[MODE_FLAG_KEY] !== serializeMode(normalizedConfig.mode);
  const needsMultiplierWrite =
    typeof flags[MULTIPLIER_FLAG_KEY] !== 'number' ||
    flags[MULTIPLIER_FLAG_KEY] !== normalizedConfig.multiplier;
  const needsEmpoweredWrite = flags[EMPOWERED_MULTIPLIER_FLAG_KEY] !== normalizedConfig.empoweredMultiplier;
  const needsResplendentWrite = flags[RESPLENDENT_MULTIPLIER_FLAG_KEY] !== normalizedConfig.resplendentMultiplier;
  const needsIncandescentWrite = flags[INCANDESCENT_MULTIPLIER_FLAG_KEY] !== normalizedConfig.incandescentMultiplier;
  const needsTranscendentWrite = flags[TRANSCENDENT_MULTIPLIER_FLAG_KEY] !== normalizedConfig.transcendentMultiplier;

  const needsLegacyMigration =
    flags[MODE_FLAG_KEY] === undefined ||
    flags[MULTIPLIER_FLAG_KEY] === undefined ||
    flags[LEGACY_MODE_FLAG_KEY] !== undefined ||
    flags[LEGACY_MULTIPLIER_FLAG_KEY] !== undefined;

  if (needsModeWrite || needsMultiplierWrite || needsEmpoweredWrite || needsResplendentWrite || needsIncandescentWrite || needsTranscendentWrite || needsLegacyMigration) {
    persistRuntimeConfig(normalizedConfig);
  }
}

function updateRuntimeConfig(partialConfig: Partial<RuntimeConfig>): RuntimeConfig {
  const normalizedConfig: RuntimeConfig = {
    ...getRuntimeConfig(),
    ...partialConfig,
  };

  normalizedConfig.mode = normalizeMode(normalizedConfig.mode);
  normalizedConfig.multiplier = clampMultiplier(normalizedConfig.multiplier);
  normalizedConfig.empoweredMultiplier = clampRarityMultiplier(normalizedConfig.empoweredMultiplier);
  normalizedConfig.resplendentMultiplier = clampRarityMultiplier(normalizedConfig.resplendentMultiplier);
  normalizedConfig.incandescentMultiplier = clampRarityMultiplier(normalizedConfig.incandescentMultiplier);
  normalizedConfig.transcendentMultiplier = clampRarityMultiplier(normalizedConfig.transcendentMultiplier);
  persistRuntimeConfig(normalizedConfig);
  return normalizedConfig;
}

function getAppliedMultiplier(
  vanillaMultiplier: number,
  config: RuntimeConfig,
): number {
  return config.mode === 'neverWorse'
    ? Math.max(vanillaMultiplier, config.multiplier)
    : config.multiplier;
}

function setLastExploreDiagnostics(value: JsonRecord) {
  lastExploreDiagnostics = {
    recordedAt: new Date().toISOString(),
    version: MOD_METADATA.version,
    config: cloneForDebug(value.config ?? getRuntimeConfig()),
    ...cloneForDebug(value),
  };
}

function getPlayerName(player: Pick<PlayerEntity, 'forename' | 'surname'>): string {
  return [player.forename, player.surname].filter(Boolean).join(' ').trim();
}

function getRarityWeight(rarity: string | undefined): number {
  const rarityIndex = RARITIES.indexOf(rarity ?? '');
  return rarityIndex === -1 ? 1 : RARITIES.length - rarityIndex;
}

function hashPlayerName(value: string): number {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return hash >>> 0;
}

function buildShuffledIndexes(length: number, seed: number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  let state = seed;

  for (let index = length - 1; index > 0; index -= 1) {
    state = ((state * 1664525 + 1013904223) | 0) >>> 0;
    const swapIndex = state % (index + 1);
    const current = indexes[index];
    indexes[index] = indexes[swapIndex];
    indexes[swapIndex] = current;
  }

  return indexes;
}

function getVanillaPityTierWeights(length: number): number[] {
  return Array.from({ length }, (_, index) =>
    index < VANILLA_PITY_MULTIPLIERS.length
      ? VANILLA_PITY_MULTIPLIERS[index]
      : VANILLA_DEFAULT_PITY_MULTIPLIER,
  );
}

function getAllPityConditions(): string[] {
  return Object.values(getLocations())
    .flatMap((location) => location.events ?? [])
    .filter((event) => Boolean(event?.pity))
    .map((event) => String(event.condition ?? ''))
    .sort();
}

function getVanillaPityMultiplier(
  condition: string | undefined,
  playerName: string,
  allPityConditions: string[],
): number {
  if (!condition) {
    return VANILLA_DEFAULT_PITY_MULTIPLIER;
  }

  const conditionIndex = allPityConditions.indexOf(condition);

  if (conditionIndex === -1) {
    return VANILLA_DEFAULT_PITY_MULTIPLIER;
  }

  const pityCount = allPityConditions.length;
  const shuffledIndexes = buildShuffledIndexes(pityCount, hashPlayerName(playerName));

  return getVanillaPityTierWeights(pityCount)[shuffledIndexes[conditionIndex]];
}

function getPityProgress(
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

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return 0;
}

function buildEventAdjustment(
  event: LocationEvent,
  index: number,
  context: Pick<
    ExplorePatchContext,
    | 'config'
    | 'playerName'
    | 'pityProgressMultiplier'
    | 'lastEventIndex'
    | 'lastEventCount'
  > & {
    allPityConditions: string[];
  },
): EventAdjustment | null {
  const baseWeight = getRarityWeight(event.rarity);
  let nativeCount = 0;
  let adjustedCount = 0;
  let vanillaMultiplier = 1;
  let appliedMultiplier = 1;

  if (event.pity) {
    vanillaMultiplier = getVanillaPityMultiplier(
      event.condition,
      context.playerName,
      context.allPityConditions,
    );
    appliedMultiplier = getAppliedMultiplier(vanillaMultiplier, context.config);

    nativeCount = Math.max(1, Math.ceil(baseWeight * vanillaMultiplier));
    nativeCount = Math.ceil(nativeCount * context.pityProgressMultiplier);

    adjustedCount = Math.max(1, Math.ceil(baseWeight * appliedMultiplier));
    adjustedCount = Math.ceil(adjustedCount * context.pityProgressMultiplier);
  } else {
    nativeCount = baseWeight;
    switch (event.rarity) {
      case 'empowered':
        appliedMultiplier = context.config.empoweredMultiplier;
        break;
      case 'resplendent':
        appliedMultiplier = context.config.resplendentMultiplier;
        break;
      case 'incandescent':
        appliedMultiplier = context.config.incandescentMultiplier;
        break;
      case 'transcendent':
        appliedMultiplier = context.config.transcendentMultiplier;
        break;
      default:
        appliedMultiplier = 1;
        break;
    }
    
    if (appliedMultiplier <= 1) {
      return null;
    }
    
    adjustedCount = Math.ceil(baseWeight * appliedMultiplier);
  }

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
    configuredMultiplier: event.pity ? context.config.multiplier : appliedMultiplier,
    appliedMultiplier,
    fixedMultiplier: appliedMultiplier,
    nativeCount,
    adjustedCount,
    fixedCount: adjustedCount,
    delta: adjustedCount - nativeCount,
  };
}

function buildLocationAdjustments(
  locationName: string,
  preferredFlags?: Record<string, number>,
  candidateEvents?: LocationEvent[],
): {
  diagnostics: JsonRecord;
  context: ExplorePatchContext | null;
} {
  const snapshot = getSnapshot();
  const player = snapshot?.player?.player;
  const location = getLocations()[locationName];

  if (!snapshot || !player || !locationName || !location) {
    return {
      diagnostics: {
        ready: false,
        reason: 'missing snapshot, player, or location',
        location: locationName || null,
      },
      context: null,
    };
  }

  const config = getRuntimeConfig();
  const playerName = getPlayerName(player);
  const pityProgress = getPityProgress(snapshot, preferredFlags);
  const pityProgressMultiplier = Math.min(1 + pityProgress * 0.1, 5);
  const isCurrentLocation = snapshot.location.current === locationName;
  const lastEventIndex =
    isCurrentLocation && typeof snapshot.location.currentLocationLastEvent === 'number'
      ? snapshot.location.currentLocationLastEvent
      : null;
  const lastEventCount = isCurrentLocation
    ? Number(snapshot.location.currentLocationLastEventCount ?? 0)
    : 0;
  const locationEvents = candidateEvents ?? location.events ?? [];
  const allPityConditions = getAllPityConditions();
  const adjustments = locationEvents
    .map((event, index) =>
      buildEventAdjustment(event, index, {
        config,
        playerName,
        pityProgressMultiplier,
        lastEventIndex,
        lastEventCount,
        allPityConditions,
      }),
    )
    .filter((value): value is EventAdjustment => Boolean(value));
  const adjustmentsByKey = new Map<string, EventAdjustment>(
    adjustments.map((adjustment) => [
      `${adjustment.index}:${adjustment.condition ?? ''}`,
      adjustment,
    ]),
  );

  return {
    diagnostics: {
      ready: true,
      config,
      playerName,
      currentLocationName: snapshot.location.current ?? null,
      locationName,
      pityProgress,
      pityProgressMultiplier,
      lastEventIndex,
      lastEventCount,
      locationEventCount: (location.events ?? []).length,
      candidateEventCount: locationEvents.length,
      pityConditionCount: allPityConditions.length,
      adjustmentCount: adjustments.length,
      adjustments,
    },
    context: {
      startedAt: new Date().toISOString(),
      playerName,
      locationName,
      pityProgress,
      pityProgressMultiplier,
      lastEventIndex,
      lastEventCount,
      config,
      adjustments,
      adjustmentsByKey,
      pushTrackingByKey: new Map(),
    },
  };
}

function finalizeExplorePatch(context: ExplorePatchContext) {
  if (activeExplorePatch !== context) {
    return;
  }

  activeExplorePatch = null;
  Array.prototype.push = originalArrayPush;
  setLastExploreDiagnostics({
    status: 'completed',
    trigger: 'onGenerateExploreEvents',
    config: context.config,
    playerName: context.playerName,
    locationName: context.locationName,
    pityProgress: context.pityProgress,
    pityProgressMultiplier: context.pityProgressMultiplier,
    adjustments: context.adjustments.map((adjustment) => {
      const key = `${adjustment.index}:${adjustment.condition ?? ''}`;
      const tracking = context.pushTrackingByKey.get(key);

      return {
        ...adjustment,
        observedNativePushes: tracking?.nativeSeen ?? 0,
        observedAdjustedPushes: tracking?.adjustedPushed ?? 0,
      };
    }),
  });
}

function beginExplorePatch(context: ExplorePatchContext) {
  if (activeExplorePatch) {
    return;
  }

  activeExplorePatch = context;
  Array.prototype.push = patchedArrayPush;
  queueMicrotask(() => finalizeExplorePatch(context));
  setTimeout(() => finalizeExplorePatch(context), 0);
}

function buildAdjustedPushItems(
  context: ExplorePatchContext,
  value: unknown,
): unknown[] {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { index?: unknown }).index !== 'number'
  ) {
    return [value];
  }

  const weightedEvent = value as { index: number; event: LocationEvent };
  const key = `${weightedEvent.index}:${String(weightedEvent.event.condition ?? '')}`;
  const adjustment = context.adjustmentsByKey.get(key);

  if (!adjustment) {
    return [value];
  }

  let tracking = context.pushTrackingByKey.get(key);

  if (!tracking) {
    tracking = {
      nativeSeen: 0,
      adjustedPushed: 0,
    };
    context.pushTrackingByKey.set(key, tracking);
  }

  tracking.nativeSeen += 1;

  if (adjustment.adjustedCount <= adjustment.nativeCount) {
    if (tracking.nativeSeen > adjustment.adjustedCount) {
      return [];
    }

    tracking.adjustedPushed += 1;
    return [value];
  }

  if (tracking.nativeSeen === 1) {
    const extraCopies = adjustment.adjustedCount - adjustment.nativeCount;
    const copies = [value, ...Array.from({ length: extraCopies }, () => value)];
    tracking.adjustedPushed += copies.length;
    return copies;
  }

  tracking.adjustedPushed += 1;
  return [value];
}

function patchedArrayPush(this: unknown[], ...values: unknown[]): number {
  const context = activeExplorePatch;

  if (!context) {
    return originalArrayPush.apply(this, values);
  }

  const adjustedValues = values.flatMap((value) =>
    buildAdjustedPushItems(context, value),
  );

  if (adjustedValues.length === 0) {
    return this.length;
  }

  return originalArrayPush.apply(this, adjustedValues);
}

function inspectCurrentExplore(): JsonRecord {
  const snapshot = getSnapshot();
  const locationName = snapshot?.location?.current;

  if (!locationName) {
    return {
      ready: false,
      reason: 'missing current location',
    };
  }

  return buildLocationAdjustments(locationName).diagnostics;
}

function inspectLocation(locationName?: string): JsonRecord {
  const snapshot = getSnapshot();
  const inspectedLocationName = locationName ?? snapshot?.location?.current;

  if (!inspectedLocationName) {
    return {
      ready: false,
      reason: 'location not provided',
    };
  }

  return buildLocationAdjustments(inspectedLocationName).diagnostics;
}

function createTextElement(
  createElement: (...args: unknown[]) => unknown,
  tagName: string,
  key: string,
  text: string,
  style?: JsonRecord,
) {
  return createElement(tagName, { key, style }, text);
}

function createSlider(
  createElement: (...args: unknown[]) => unknown,
  key: string,
  label: string,
  min: number,
  max: number,
  value: number,
  onChange: (value: number) => void,
) {
  return createElement(
    'label',
    {
      key,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
    },
    [
      createTextElement(
        createElement,
        'div',
        `${key}-label`,
        `${label}: ${value}x`,
        {
          fontWeight: 600,
        },
      ),
      createElement('input', {
        key: `${key}-input`,
        type: 'range',
        min,
        max,
        step: 1,
        value,
        onChange: (event: Event) => {
          const target = event.target as HTMLInputElement | null;
          onChange(Number(target?.value));
        },
        style: {
          width: '100%',
        },
      }),
      createElement(
        'div',
        {
          key: `${key}-marks`,
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            opacity: 0.75,
          },
        },
        [
          createTextElement(createElement, 'span', `${key}-mark1`, `${min}x`),
          createTextElement(createElement, 'span', `${key}-markMid`, `${Math.floor((min + max) / 2)}x`),
          createTextElement(createElement, 'span', `${key}-markMax`, `${max}x`),
        ],
      ),
    ],
  );
}

const LuckyAllAroundOptions: ModOptionsFC = ({ api }) => {
  const ReactRuntime = window.React;

  if (
    !ReactRuntime?.createElement ||
    !ReactRuntime.useEffect ||
    !ReactRuntime.useState
  ) {
    throw new Error('React runtime unavailable for options UI');
  }

  const createElement = ReactRuntime.createElement.bind(ReactRuntime);
  const [config, setConfig] = ReactRuntime.useState<RuntimeConfig>(getRuntimeConfig());
  const GameButton = api.components.GameButton ?? 'button';

  ReactRuntime.useEffect(() => {
    setConfig(getRuntimeConfig());
  }, []);

  const applyConfig = (partialConfig: Partial<RuntimeConfig>) => {
    const nextConfig = updateRuntimeConfig(partialConfig);
    setConfig(nextConfig);
  };
  const isForceMode = config.mode === 'force';
  const forceLabel = isForceMode
    ? `Force ${config.multiplier}x Selected`
    : `Use Force ${config.multiplier}x`;
  const neverWorseLabel = isForceMode
    ? `Use Never Worse ${config.multiplier}x`
    : `Never Worse ${config.multiplier}x Selected`;
  const modeDescription = isForceMode
    ? `Force mode replaces the vanilla tier for every pity event. Native 8x and 10x tiers can be reduced to ${config.multiplier}x.`
    : `Never Worse mode keeps higher vanilla tiers and only raises lower tiers up to at least ${config.multiplier}x.`;

  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '8px 4px 4px',
        overflow: 'auto',
        maxHeight: '100%',
      },
    },
    [
      // --- Pity Events Configuration ---
      createTextElement(
        createElement,
        'div',
        'pity-title',
        'Exclusive Event Options',
        {
          fontWeight: 700,
          fontSize: '1.2rem',
          borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
          paddingBottom: '4px',
          marginTop: '4px',
        }
      ),
      createTextElement(
        createElement,
        'div',
        'pity-intro',
        'Configure how exclusive, player-seeded pity events are weighted.',
        {
          lineHeight: 1.45,
          opacity: 0.9,
        },
      ),
      createElement(
        'div',
        {
          key: 'mode',
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          },
        },
        [
          createTextElement(
            createElement,
            'div',
            'modeLabel',
            'Mode',
            {
              fontWeight: 600,
            },
          ),
          createElement(
            'div',
            {
              key: 'modeButtons',
              style: {
                display: 'flex',
                gap: '12px',
              },
            },
            [
              createElement(
                GameButton,
                {
                  key: 'force',
                  onClick: () => applyConfig({ mode: 'force' }),
                },
                forceLabel,
              ),
              createElement(
                GameButton,
                {
                  key: 'neverWorse',
                  onClick: () => applyConfig({ mode: 'neverWorse' }),
                },
                neverWorseLabel,
              ),
            ],
          ),
        ],
      ),
      createSlider(
        createElement,
        'slider-pity',
        'Luck multiplier',
        MIN_PITY_MULTIPLIER,
        MAX_PITY_MULTIPLIER,
        config.multiplier,
        (val) => applyConfig({ multiplier: val })
      ),
      createTextElement(
        createElement,
        'div',
        'modeDescription',
        modeDescription,
        {
          lineHeight: 1.45,
          opacity: 0.85,
        },
      ),

      // --- Rarity Events Configuration ---
      createTextElement(
        createElement,
        'div',
        'rarity-title',
        'Rare Event Luck Boosts',
        {
          fontWeight: 700,
          fontSize: '1.2rem',
          borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
          paddingBottom: '4px',
          marginTop: '16px',
        }
      ),
      createTextElement(
        createElement,
        'div',
        'rarity-intro',
        'Boost your chances of encountering rare items and events while exploring without altering actual drop quantities or combat difficulty. Higher multipliers dramatically increase how frequently these rare events appear.',
        {
          lineHeight: 1.45,
          opacity: 0.9,
        },
      ),
      createSlider(
        createElement,
        'slider-empowered',
        'Empowered Event Multiplier',
        MIN_RARITY_MULTIPLIER,
        MAX_RARITY_MULTIPLIER,
        config.empoweredMultiplier,
        (val) => applyConfig({ empoweredMultiplier: val })
      ),
      createSlider(
        createElement,
        'slider-resplendent',
        'Resplendent Event Multiplier',
        MIN_RARITY_MULTIPLIER,
        MAX_RARITY_MULTIPLIER,
        config.resplendentMultiplier,
        (val) => applyConfig({ resplendentMultiplier: val })
      ),
      createSlider(
        createElement,
        'slider-incandescent',
        'Incandescent Event Multiplier',
        MIN_RARITY_MULTIPLIER,
        MAX_RARITY_MULTIPLIER,
        config.incandescentMultiplier,
        (val) => applyConfig({ incandescentMultiplier: val })
      ),
      createSlider(
        createElement,
        'slider-transcendent',
        'Transcendent Event Multiplier',
        MIN_RARITY_MULTIPLIER,
        MAX_RARITY_MULTIPLIER,
        config.transcendentMultiplier,
        (val) => applyConfig({ transcendentMultiplier: val })
      ),
    ],
  );
};

function getAvailableModApiFeatures(): JsonRecord {
  return {
    hasGenerateExploreEventsHook: Boolean(window.modAPI?.hooks?.onGenerateExploreEvents),
    hasLootDropHook: Boolean(window.modAPI?.hooks?.onLootDrop),
    hasBeforeCombatHook: Boolean(window.modAPI?.hooks?.onBeforeCombat),
    hasCalculateDamageHook: Boolean(window.modAPI?.hooks?.onCalculateDamage),
    hasReduxActionHook: Boolean(window.modAPI?.hooks?.onReduxAction),
    hasRegisterOptionsUI: Boolean(window.modAPI?.actions?.registerOptionsUI),
    hasGlobalFlags: Boolean(
      window.modAPI?.actions?.getGlobalFlags &&
        window.modAPI?.actions?.setGlobalFlag,
    ),
    hasStateSnapshot: Boolean(window.modAPI?.getGameStateSnapshot),
    hasSubscribe: Boolean(window.modAPI?.subscribe),
  };
}

function installExploreInterceptor() {
  const registerHook = window.modAPI?.hooks?.onGenerateExploreEvents;

  if (!registerHook) {
    setLastExploreDiagnostics({
      status: 'skipped',
      trigger: 'onGenerateExploreEvents',
      reason: 'ModAPI explore hook unavailable',
    });
    return;
  }

  registerHook((locationName, events, flags) => {
    const { diagnostics, context } = buildLocationAdjustments(
      locationName,
      flags,
      events,
    );

    setLastExploreDiagnostics({
      status: context ? 'armed' : 'skipped',
      trigger: 'onGenerateExploreEvents',
      hookEventCount: events.length,
      ...diagnostics,
    });

    if (context) {
      beginExplorePatch(context);
    }

    return events;
  });
}

function installOptionsUi() {
  window.modAPI?.actions?.registerOptionsUI?.(LuckyAllAroundOptions);
}

function installLootDropTracker() {
  const registerHook = window.modAPI?.hooks?.onLootDrop;

  if (!registerHook) {
    return;
  }

  registerHook((items, flags) => {
    const config = getRuntimeConfig();
    lastLootDropDiagnostics = {
      recordedAt: new Date().toISOString(),
      version: MOD_METADATA.version,
      config: cloneForDebug(config),
      itemCount: items.length,
      items: cloneForDebug(
        items.map((item) => ({
          name: item.name,
          rarity: (item as { rarity?: string }).rarity ?? null,
          count: (item as { count?: number }).count ?? 1,
        })),
      ),
      flags: cloneForDebug(flags),
      lastExploreStatus: lastExploreDiagnostics?.status ?? null,
    };
  });
}

function installDebugApi() {
  const debugApi = {
    getVersion: () => MOD_METADATA.version,
    isInstalled: () => true,
    getConfig: () => cloneForDebug(getRuntimeConfig()),
    getLastExplore: () => cloneForDebug(lastExploreDiagnostics),
    getLastLootDrop: () => cloneForDebug(lastLootDropDiagnostics),
    inspectCurrentExplore: () => cloneForDebug(inspectCurrentExplore()),
    inspectLocation: (locationName?: string) =>
      cloneForDebug(inspectLocation(locationName)),
  };

  window.luckyAllAroundDebug = debugApi;
  window.luckyAllAroundX6Debug = debugApi;
}

if (!window.__luckyAllAroundInstalled && !window.__luckyAllAroundX6Installed) {
  window.__luckyAllAroundInstalled = true;
  window.__luckyAllAroundX6Installed = true;
  ensureNormalizedRuntimeConfig();
  installExploreInterceptor();
  installLootDropTracker();
  installOptionsUi();
  installDebugApi();

  const locationCount = Object.keys(getLocations()).length;
  const pityConditionCount = getAllPityConditions().length;
  const config = getRuntimeConfig();
  const modApiFeatures = getAvailableModApiFeatures();

  setLastExploreDiagnostics({
    status: 'installed',
    config,
    capturedLocationCount: locationCount,
    pityConditionCount,
    modApiFeatures,
  });
  log(
    'Installed ModAPI explore hook with weighted candidate patch',
    JSON.stringify({
      capturedLocationCount: locationCount,
      pityConditionCount,
      config,
      modApiFeatures,
    }),
  );
} else {
  log('Patch already installed');
}