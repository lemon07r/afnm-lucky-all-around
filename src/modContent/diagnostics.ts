import { getRuntimeConfig } from './config';
import { cloneForDebug, type JsonRecord } from './logic';

let lastExploreDiagnostics: JsonRecord | null = null;
let lastLootDropDiagnostics: JsonRecord | null = null;

export function setLastExploreDiagnostics(value: JsonRecord): void {
  lastExploreDiagnostics = {
    recordedAt: new Date().toISOString(),
    version: MOD_METADATA.version,
    config: cloneForDebug(value.config ?? getRuntimeConfig()),
    ...cloneForDebug(value),
  };
}

export function installLootDropTracker(): void {
  window.modAPI?.hooks?.onLootDrop?.((items, flags) => {
    lastLootDropDiagnostics = {
      recordedAt: new Date().toISOString(),
      version: MOD_METADATA.version,
      config: cloneForDebug(getRuntimeConfig()),
      itemCount: items.length,
      items: cloneForDebug(
        items.map((item) => ({
          name: item.name,
          rarity: item.rarity ?? null,
          count: (item as { count?: number }).count ?? 1,
        })),
      ),
      flags: cloneForDebug(flags),
      lastExploreStatus: lastExploreDiagnostics?.status ?? null,
    };
  });
}

export function getAvailableModApiFeatures(): JsonRecord {
  return {
    hasGenerateExploreEventsHook: Boolean(
      window.modAPI?.hooks?.onGenerateExploreEvents,
    ),
    hasLootDropHook: Boolean(window.modAPI?.hooks?.onLootDrop),
    hasRegisterOptionsUI: Boolean(window.modAPI?.actions?.registerOptionsUI),
    hasGlobalFlags: Boolean(
      window.modAPI?.actions?.getGlobalFlags &&
        window.modAPI?.actions?.setGlobalFlag,
    ),
    hasStateSnapshot: Boolean(window.modAPI?.getGameStateSnapshot),
    hasSubscribe: Boolean(window.modAPI?.subscribe),
  };
}

export function getCompatibilityDiagnostics(): JsonRecord {
  const features = getAvailableModApiFeatures();
  const required = [
    'hasGenerateExploreEventsHook',
    'hasRegisterOptionsUI',
    'hasGlobalFlags',
    'hasStateSnapshot',
  ];
  const missingRequiredFeatures = required.filter((feature) => !features[feature]);
  return {
    compiledAfnmTypes: MOD_METADATA.gameVersion ?? null,
    modVersion: MOD_METADATA.version,
    compatible: missingRequiredFeatures.length === 0,
    missingRequiredFeatures,
    features,
  };
}

export function getCompatibilitySummary(): string {
  const diagnostics = getCompatibilityDiagnostics();
  const compiled = diagnostics.compiledAfnmTypes ?? 'unknown';
  const missing = diagnostics.missingRequiredFeatures as string[];
  return missing.length === 0
    ? `Compatibility: AFNM types ${compiled}; required ModAPI features detected.`
    : `Compatibility: AFNM types ${compiled}; missing ${missing.join(', ')}.`;
}

export function installDebugApi(
  inspectCurrentExplore: () => JsonRecord,
  inspectLocation: (locationName?: string) => JsonRecord,
): void {
  const debugApi = {
    getVersion: () => MOD_METADATA.version,
    isInstalled: () => true,
    getConfig: () => cloneForDebug(getRuntimeConfig()),
    getLastExplore: () => cloneForDebug(lastExploreDiagnostics),
    getLastLootDrop: () => cloneForDebug(lastLootDropDiagnostics),
    getCompatibility: () => cloneForDebug(getCompatibilityDiagnostics()),
    inspectCurrentExplore: () => cloneForDebug(inspectCurrentExplore()),
    inspectLocation: (locationName?: string) =>
      cloneForDebug(inspectLocation(locationName)),
  };
  window.luckyAllAroundDebug = debugApi;
  window.luckyAllAroundX6Debug = debugApi;
}
