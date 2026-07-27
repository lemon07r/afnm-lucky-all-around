import { ensureNormalizedRuntimeConfig, getRuntimeConfig } from './config';
import {
  getAvailableModApiFeatures,
  installDebugApi,
  installLootDropTracker,
  setLastExploreDiagnostics,
} from './diagnostics';
import {
  getAllPityConditions,
  getLocations,
  inspectCurrentExplore,
  inspectLocation,
  installExploreInterceptor,
} from './interceptor';
import { installOptionsUi } from './options';

const MOD_TAG = '[LuckyAllAround]';

if (!window.__luckyAllAroundInstalled && !window.__luckyAllAroundX6Installed) {
  window.__luckyAllAroundInstalled = true;
  window.__luckyAllAroundX6Installed = true;
  ensureNormalizedRuntimeConfig();
  installExploreInterceptor();
  installLootDropTracker();
  installOptionsUi();
  installDebugApi(inspectCurrentExplore, inspectLocation);

  const installState = {
    capturedLocationCount: Object.keys(getLocations()).length,
    pityConditionCount: getAllPityConditions().length,
    config: getRuntimeConfig(),
    modApiFeatures: getAvailableModApiFeatures(),
  };
  setLastExploreDiagnostics({ status: 'installed', ...installState });
  console.log(
    MOD_TAG,
    'Installed ModAPI explore hook with weighted candidate patch',
    JSON.stringify(installState),
  );
} else {
  console.log(MOD_TAG, 'Patch already installed');
}
