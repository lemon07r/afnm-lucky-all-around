import type { ModAPI } from 'afnm-types';

declare global {
  const MOD_METADATA: {
    name: string;
    version: string;
    author: { name: string };
    description: string;
    gameVersion?: string;
  };

  type LuckyAllAroundConfig = {
    mode: 'force' | 'neverWorse';
    multiplier: number;
  };

  type LuckyAllAroundDebugApi = {
    getVersion: () => string;
    isInstalled: () => boolean;
    getConfig: () => LuckyAllAroundConfig;
    getLastExplore: () => unknown;
    inspectCurrentExplore: () => unknown;
    inspectLocation: (locationName?: string) => unknown;
  };

  type LuckyAllAroundX6DebugApi = LuckyAllAroundDebugApi;

  interface Window {
    React?: {
      createElement: (...args: any[]) => any;
      useEffect?: (...args: any[]) => any;
      useState?: <T>(
        initialState: T,
      ) => [T, (value: T | ((previousValue: T) => T)) => void];
    };
    modAPI?: ModAPI;
    __luckyAllAroundInstalled?: boolean;
    __luckyAllAroundX6Installed?: boolean;
    luckyAllAroundDebug?: LuckyAllAroundDebugApi;
    luckyAllAroundX6Debug?: LuckyAllAroundX6DebugApi;
  }
}

export {};
