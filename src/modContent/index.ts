type LooseRecord = Record<string, any>;

type StoreLike = {
  dispatch: (action: any) => any;
  getState: () => LooseRecord;
  subscribe?: (listener: () => void) => () => void;
};

type LuckMode = 'force' | 'neverWorse';

type RuntimeConfig = {
  mode: LuckMode;
  multiplier: number;
};

type PityAdjustment = {
  index: number;
  condition: string | null;
  rarity: string | null;
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
  adjustments: PityAdjustment[];
  adjustmentsByKey: Map<string, PityAdjustment>;
  pushTrackingByKey: Map<string, { nativeSeen: number; adjustedPushed: number }>;
};

const MOD_TAG = '[LuckyAllAround]';
const EXPLORE_PREFIX = 'Explore';
const DEFAULT_PITY_MULTIPLIER = 6;
const MIN_PITY_MULTIPLIER = 1;
const MAX_PITY_MULTIPLIER = 10;
const MODE_FLAG_KEY = 'luckyAllAround.mode';
const MULTIPLIER_FLAG_KEY = 'luckyAllAround.multiplier';
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

const capturedLocations = (window.modAPI?.gameData?.locations ??
  {}) as Record<string, any>;
const allPityConditions = Object.values(capturedLocations)
  .flatMap((location) => location?.events ?? [])
  .filter((event) => Boolean(event?.pity))
  .map((event) => String(event.condition ?? ''))
  .sort();

const originalArrayPush = Array.prototype.push;

let activeExplorePatch: ExplorePatchContext | null = null;
let lastExploreDiagnostics: LooseRecord | null = null;

function log(message: string, ...args: unknown[]) {
  console.log(MOD_TAG, message, ...args);
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

function normalizeMode(value: unknown): LuckMode {
  return value === 'neverWorse' ? 'neverWorse' : 'force';
}

function getRuntimeConfig(): RuntimeConfig {
  const globalFlags = window.modAPI?.actions?.getGlobalFlags?.() ?? {};

  return {
    mode: normalizeMode(globalFlags[MODE_FLAG_KEY] ?? globalFlags[LEGACY_MODE_FLAG_KEY]),
    multiplier: clampMultiplier(
      globalFlags[MULTIPLIER_FLAG_KEY] ?? globalFlags[LEGACY_MULTIPLIER_FLAG_KEY],
    ),
  };
}

function updateRuntimeConfig(partialConfig: Partial<RuntimeConfig>): RuntimeConfig {
  const nextConfig = {
    ...getRuntimeConfig(),
    ...partialConfig,
  };
  const normalizedConfig: RuntimeConfig = {
    mode: normalizeMode(nextConfig.mode),
    multiplier: clampMultiplier(nextConfig.multiplier),
  };

  window.modAPI?.actions?.setGlobalFlag?.(MODE_FLAG_KEY, normalizedConfig.mode);
  window.modAPI?.actions?.setGlobalFlag?.(
    MULTIPLIER_FLAG_KEY,
    normalizedConfig.multiplier,
  );

  return normalizedConfig;
}

function describeConfig(config: RuntimeConfig): string {
  if (config.mode === 'neverWorse') {
    return `never worse than ${config.multiplier}x`;
  }

  return `force ${config.multiplier}x`;
}

function getAppliedMultiplier(
  vanillaMultiplier: number,
  config: RuntimeConfig,
): number {
  return config.mode === 'neverWorse'
    ? Math.max(vanillaMultiplier, config.multiplier)
    : config.multiplier;
}

function setLastExploreDiagnostics(value: LooseRecord) {
  lastExploreDiagnostics = {
    recordedAt: new Date().toISOString(),
    version: MOD_METADATA.version,
    config: cloneForDebug(value.config ?? getRuntimeConfig()),
    ...cloneForDebug(value),
  };
}

function getStore(): StoreLike | null {
  if (!window.gameStore?.dispatch || !window.gameStore.getState) {
    return null;
  }

  return window.gameStore as StoreLike;
}

function getPlayerName(player: any): string {
  return [player?.forename, player?.surname].filter(Boolean).join(' ').trim();
}

function getExploreButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const button = target.closest('button');
  if (!(button instanceof HTMLButtonElement)) {
    return null;
  }

  const label = button.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  if (!label.startsWith(EXPLORE_PREFIX)) {
    return null;
  }

  return button;
}

function getRarityWeight(rarity: string | undefined): number {
  return RARITIES.length - RARITIES.indexOf(rarity ?? '');
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

function getVanillaPityMultiplier(
  condition: string | undefined,
  playerName: string,
): number {
  if (!condition) {
    return VANILLA_DEFAULT_PITY_MULTIPLIER;
  }

  const conditionIndex = allPityConditions.indexOf(condition);

  if (conditionIndex === -1) {
    return VANILLA_DEFAULT_PITY_MULTIPLIER;
  }

  const pityCount = allPityConditions.length;
  const shuffledIndexes = buildShuffledIndexes(
    pityCount,
    hashPlayerName(playerName),
  );

  return getVanillaPityTierWeights(pityCount)[shuffledIndexes[conditionIndex]];
}

function getReactFiberFromElement(element: Element): any | null {
  const ownKeys = Object.getOwnPropertyNames(element as object);

  for (const key of ownKeys) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactContainer$')) {
      return (element as LooseRecord)[key];
    }
  }

  return null;
}

function findFlagsInFiber(fiber: any): LooseRecord | null {
  let current = fiber;

  while (current) {
    const flagsFromMemoized = current.memoizedProps?.value?.flags;

    if (flagsFromMemoized && typeof flagsFromMemoized === 'object') {
      return flagsFromMemoized as LooseRecord;
    }

    const flagsFromPending = current.pendingProps?.value?.flags;

    if (flagsFromPending && typeof flagsFromPending === 'object') {
      return flagsFromPending as LooseRecord;
    }

    current = current.return;
  }

  return null;
}

function getFlagsFromButton(button: HTMLButtonElement): LooseRecord {
  let currentElement: Element | null = button;

  while (currentElement) {
    const fiber = getReactFiberFromElement(currentElement);

    if (fiber) {
      const flags = findFlagsInFiber(fiber);

      if (flags) {
        return flags;
      }
    }

    currentElement = currentElement.parentElement;
  }

  return {};
}

function findValueByKey(
  value: unknown,
  key: string,
  seen: Set<unknown> = new Set(),
): unknown {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return undefined;
  }

  seen.add(value);

  if (Object.prototype.hasOwnProperty.call(value, key)) {
    return (value as LooseRecord)[key];
  }

  const nestedValues = Array.isArray(value)
    ? value
    : Object.values(value as LooseRecord);

  for (const nestedValue of nestedValues) {
    const foundValue = findValueByKey(nestedValue, key, seen);

    if (foundValue !== undefined) {
      return foundValue;
    }
  }

  return undefined;
}

function getPityProgress(state: LooseRecord, preferredFlags?: LooseRecord): number {
  const candidateSources = [preferredFlags, state.gameEvent?.flags, state];

  for (const source of candidateSources) {
    const foundValue = findValueByKey(source, 'globalSpecialEventPity');
    const numericValue = Number(foundValue);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return 0;
}

function buildPityAdjustment(
  event: any,
  index: number,
  context: Pick<
    ExplorePatchContext,
    | 'config'
    | 'playerName'
    | 'pityProgressMultiplier'
    | 'lastEventIndex'
    | 'lastEventCount'
  >,
): PityAdjustment | null {
  if (!event?.pity) {
    return null;
  }

  const baseWeight = getRarityWeight(event.rarity);
  const vanillaMultiplier = getVanillaPityMultiplier(
    event.condition,
    context.playerName,
  );
  const appliedMultiplier = getAppliedMultiplier(vanillaMultiplier, context.config);

  let nativeCount = Math.max(1, Math.ceil(baseWeight * vanillaMultiplier));
  nativeCount = Math.ceil(nativeCount * context.pityProgressMultiplier);

  let adjustedCount = Math.max(1, Math.ceil(baseWeight * appliedMultiplier));
  adjustedCount = Math.ceil(adjustedCount * context.pityProgressMultiplier);

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
    baseWeight,
    vanillaMultiplier,
    configuredMultiplier: context.config.multiplier,
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
  preferredFlags?: LooseRecord,
): {
  diagnostics: LooseRecord;
  context: ExplorePatchContext | null;
} {
  const store = getStore();

  if (!store) {
    return {
      diagnostics: {
        ready: false,
        reason: 'game store unavailable',
      },
      context: null,
    };
  }

  const state = store.getState();
  const player = state.player?.player;
  const location = locationName ? capturedLocations[locationName] : undefined;

  if (!player || !locationName || !location) {
    return {
      diagnostics: {
        ready: false,
        reason: 'missing player or location',
        location: locationName ?? null,
      },
      context: null,
    };
  }

  const config = getRuntimeConfig();
  const playerName = getPlayerName(player);
  const pityProgress = getPityProgress(state, preferredFlags);
  const pityProgressMultiplier = Math.min(1 + pityProgress * 0.1, 5);
  const isCurrentLocation = state.location?.current === locationName;
  const lastEventIndex =
    isCurrentLocation && typeof state.location?.currentLocationLastEvent === 'number'
      ? state.location.currentLocationLastEvent
      : null;
  const lastEventCount = isCurrentLocation
    ? Number(state.location?.currentLocationLastEventCount ?? 0)
    : 0;
  const adjustments = (location.events ?? [])
    .map((event: any, index: number) =>
      buildPityAdjustment(event, index, {
        config,
        playerName,
        pityProgressMultiplier,
        lastEventIndex,
        lastEventCount,
      }),
    )
    .filter((value: PityAdjustment | null): value is PityAdjustment => Boolean(value));
  const adjustmentsByKey = new Map<string, PityAdjustment>(
    adjustments.map((adjustment) => [
      `${adjustment.index}:${adjustment.condition ?? ''}`,
      adjustment,
    ]),
  );

  return {
    diagnostics: {
      ready: true,
      config,
      configDescription: describeConfig(config),
      playerName,
      currentLocationName: state.location?.current ?? null,
      locationName,
      pityProgress,
      pityProgressMultiplier,
      lastEventIndex,
      lastEventCount,
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

function buildCurrentLocationAdjustments(
  button: HTMLButtonElement,
): {
  diagnostics: LooseRecord;
  context: ExplorePatchContext | null;
} {
  const store = getStore();

  if (!store) {
    return {
      diagnostics: {
        ready: false,
        reason: 'game store unavailable',
      },
      context: null,
    };
  }

  const locationName = store.getState().location?.current;

  if (!locationName) {
    return {
      diagnostics: {
        ready: false,
        reason: 'missing current location',
      },
      context: null,
    };
  }

  return buildLocationAdjustments(locationName, getFlagsFromButton(button));
}

function finalizeExplorePatch(context: ExplorePatchContext) {
  if (activeExplorePatch !== context) {
    return;
  }

  activeExplorePatch = null;
  Array.prototype.push = originalArrayPush;
  setLastExploreDiagnostics({
    status: 'completed',
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
  value: any,
): any[] {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.index !== 'number' ||
    !value.event ||
    !value.event.pity
  ) {
    return [value];
  }

  const key = `${value.index}:${String(value.event.condition ?? '')}`;
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

function patchedArrayPush(this: any[], ...values: any[]): number {
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

function inspectCurrentExplore(): LooseRecord {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) => {
    const label = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return label.startsWith(EXPLORE_PREFIX);
  });

  if (!(button instanceof HTMLButtonElement)) {
    return {
      ready: false,
      reason: 'explore button not found',
    };
  }

  return buildCurrentLocationAdjustments(button).diagnostics;
}

function inspectLocation(locationName?: string): LooseRecord {
  const store = getStore();

  if (!store) {
    return {
      ready: false,
      reason: 'game store unavailable',
    };
  }

  const inspectedLocationName = locationName ?? store.getState().location?.current;

  if (!inspectedLocationName) {
    return {
      ready: false,
      reason: 'location not provided',
    };
  }

  return buildLocationAdjustments(inspectedLocationName).diagnostics;
}

function createTextElement(
  createElement: (...args: any[]) => any,
  tagName: string,
  key: string,
  text: string,
  style?: LooseRecord,
) {
  return createElement(tagName, { key, style }, text);
}

function LuckyAllAroundOptions({ api }: { api: LooseRecord }) {
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
  const GameButton = api?.components?.GameButton ?? 'button';

  ReactRuntime.useEffect(() => {
    setConfig(getRuntimeConfig());
  }, []);

  const applyConfig = (partialConfig: Partial<RuntimeConfig>) => {
    const nextConfig = updateRuntimeConfig(partialConfig);
    setConfig(nextConfig);
  };
  const isForceMode = config.mode === 'force';
  const summaryText = `Saved globally. Current behavior: ${describeConfig(config)}.`;
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
      },
    },
    [
      createTextElement(
        createElement,
        'div',
        'intro',
        'Configure how pity-exclusive events are weighted.',
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
      createElement(
        'label',
        {
          key: 'slider',
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
            'sliderLabel',
            `Luck multiplier: ${config.multiplier}x`,
            {
              fontWeight: 600,
            },
          ),
          createElement('input', {
            key: 'sliderInput',
            type: 'range',
            min: MIN_PITY_MULTIPLIER,
            max: MAX_PITY_MULTIPLIER,
            step: 1,
            value: config.multiplier,
            onChange: (event: Event) => {
              const target = event.target as HTMLInputElement | null;
              applyConfig({ multiplier: target?.value });
            },
            style: {
              width: '100%',
            },
          }),
          createElement(
            'div',
            {
              key: 'sliderMarks',
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                opacity: 0.75,
              },
            },
            [
              createTextElement(createElement, 'span', 'mark1', '1x'),
              createTextElement(createElement, 'span', 'mark6', '6x'),
              createTextElement(createElement, 'span', 'mark10', '10x'),
            ],
          ),
        ],
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
      createTextElement(
        createElement,
        'div',
        'summary',
        summaryText,
        {
          padding: '10px 12px',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          borderRadius: '6px',
          background: 'rgba(0, 0, 0, 0.15)',
          lineHeight: 1.45,
        },
      ),
    ],
  );
}

function installExploreInterceptor() {
  document.addEventListener(
    'click',
    (event) => {
      const button = getExploreButton(event.target);

      if (!button) {
        return;
      }

      const { diagnostics, context } = buildCurrentLocationAdjustments(button);
      setLastExploreDiagnostics({
        status: context ? 'armed' : 'skipped',
        ...diagnostics,
      });

      if (!context) {
        return;
      }

      beginExplorePatch(context);
    },
    true,
  );
}

function installOptionsUi() {
  window.modAPI?.actions?.registerOptionsUI?.(LuckyAllAroundOptions);
}

function installDebugApi() {
  const debugApi = {
    getVersion: () => MOD_METADATA.version,
    isInstalled: () => true,
    getConfig: () => cloneForDebug(getRuntimeConfig()),
    getLastExplore: () => cloneForDebug(lastExploreDiagnostics),
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
  installExploreInterceptor();
  installOptionsUi();
  installDebugApi();
  setLastExploreDiagnostics({
    status: 'installed',
    config: getRuntimeConfig(),
    capturedLocationCount: Object.keys(capturedLocations).length,
    pityConditionCount: allPityConditions.length,
  });
  log(
    'Installed native explore candidate patch',
    JSON.stringify({
      capturedLocationCount: Object.keys(capturedLocations).length,
      pityConditionCount: allPityConditions.length,
      config: getRuntimeConfig(),
    }),
  );
} else {
  log('Patch already installed');
}
