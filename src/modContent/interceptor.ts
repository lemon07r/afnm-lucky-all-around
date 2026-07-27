import type { GameLocation, LocationEvent, RootState } from 'afnm-types';
import { getRuntimeConfig } from './config';
import { setLastExploreDiagnostics } from './diagnostics';
import {
  buildEventAdjustment,
  getPityProgress,
  getPlayerName,
  type EventAdjustment,
  type JsonRecord,
  type RuntimeConfig,
} from './logic';

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

type WeightedEvent = { index: number; event: LocationEvent };
const originalArrayPush = Array.prototype.push;
let activeExplorePatch: ExplorePatchContext | null = null;

export function getLocations(): Record<string, GameLocation> {
  return (window.modAPI?.gameData?.locations ?? {}) as Record<string, GameLocation>;
}

function getSnapshot(): RootState | null {
  return window.modAPI?.getGameStateSnapshot?.() ?? null;
}

export function getAllPityConditions(): string[] {
  return Object.values(getLocations())
    .flatMap((location) => location.events ?? [])
    .filter((event) => Boolean(event?.pity))
    .map((event) => String(event.condition ?? ''))
    .sort();
}

function buildLocationAdjustments(
  locationName: string,
  preferredFlags?: Record<string, number>,
  candidateEvents?: LocationEvent[],
): { diagnostics: JsonRecord; context: ExplorePatchContext | null } {
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
    isCurrentLocation &&
    typeof snapshot.location.currentLocationLastEvent === 'number'
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
    .filter((value): value is EventAdjustment => value !== null);
  const adjustmentsByKey = new Map(
    adjustments.map((item) => [
      `${item.index}:${item.condition ?? ''}`,
      item,
    ]),
  );
  const context: ExplorePatchContext = {
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
  };
  return {
    diagnostics: {
      ready: true,
      config,
      playerName,
      locationName,
      pityProgress,
      pityProgressMultiplier,
      lastEventIndex,
      lastEventCount,
      candidateEventCount: locationEvents.length,
      pityConditionCount: allPityConditions.length,
      adjustmentCount: adjustments.length,
      adjustments,
    },
    context,
  };
}

export function buildAdjustedPushItems(
  context: ExplorePatchContext,
  value: unknown,
): unknown[] {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { index?: unknown }).index !== 'number' ||
    !(value as { event?: unknown }).event ||
    typeof (value as { event?: unknown }).event !== 'object'
  ) {
    return [value];
  }
  const weighted = value as WeightedEvent;
  const key = `${weighted.index}:${String(weighted.event.condition ?? '')}`;
  const adjustment = context.adjustmentsByKey.get(key);
  if (!adjustment) return [value];

  const tracking = context.pushTrackingByKey.get(key) ?? {
    nativeSeen: 0,
    adjustedPushed: 0,
  };
  context.pushTrackingByKey.set(key, tracking);
  tracking.nativeSeen += 1;

  if (adjustment.adjustedCount <= adjustment.nativeCount) {
    if (tracking.nativeSeen > adjustment.adjustedCount) return [];
    tracking.adjustedPushed += 1;
    return [value];
  }
  if (tracking.nativeSeen === 1) {
    const copies = Array.from(
      { length: 1 + adjustment.adjustedCount - adjustment.nativeCount },
      () => value,
    );
    tracking.adjustedPushed += copies.length;
    return copies;
  }
  tracking.adjustedPushed += 1;
  return [value];
}

function restoreExplorePatch(context: ExplorePatchContext): void {
  if (activeExplorePatch !== context) return;
  activeExplorePatch = null;
  Array.prototype.push = originalArrayPush;
  setLastExploreDiagnostics({
    status: 'completed',
    trigger: 'onGenerateExploreEvents',
    config: context.config,
    startedAt: context.startedAt,
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

export function beginExplorePatch(context: ExplorePatchContext): () => void {
  if (activeExplorePatch) return () => restoreExplorePatch(activeExplorePatch!);
  activeExplorePatch = context;
  Array.prototype.push = function patchedPush(
    this: unknown[],
    ...values: unknown[]
  ): number {
    const active = activeExplorePatch;
    if (!active) return originalArrayPush.apply(this, values);
    const adjusted = values.flatMap((value) =>
      buildAdjustedPushItems(active, value),
    );
    return adjusted.length === 0
      ? this.length
      : originalArrayPush.apply(this, adjusted);
  };
  queueMicrotask(() => restoreExplorePatch(context));
  setTimeout(() => restoreExplorePatch(context), 0);
  return () => restoreExplorePatch(context);
}

export function inspectLocation(locationName?: string): JsonRecord {
  const inspected = locationName ?? getSnapshot()?.location?.current;
  return inspected
    ? buildLocationAdjustments(inspected).diagnostics
    : { ready: false, reason: 'location not provided' };
}

export function inspectCurrentExplore(): JsonRecord {
  return inspectLocation(getSnapshot()?.location?.current);
}

export function installExploreInterceptor(): void {
  const registerHook = window.modAPI?.hooks?.onGenerateExploreEvents;
  if (!registerHook) {
    setLastExploreDiagnostics({
      status: 'skipped',
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
    if (context) beginExplorePatch(context);
    return events;
  });
}
