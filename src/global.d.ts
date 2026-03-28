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
    MaterialUI?: Record<string, any>;
    MaterialUIIcons?: Record<string, any>;
    modAPI?: {
      gameData?: {
        locations?: Record<string, any>;
        quests?: Record<string, any>;
      };
      actions?: {
        registerOptionsUI?: (component: (props: { api: any }) => any) => void;
        setGlobalFlag?: (key: string, value: unknown) => void;
        getGlobalFlags?: () => Record<string, unknown>;
      };
      utils?: {
        createCombatEvent?: (enemy: any) => any;
        flag?: (value: string) => string;
        getFullItem?: (item: any) => any;
      };
    };
    gameStore?: {
      dispatch: (action: any) => any;
      originalDispatch?: (action: any) => any;
      getState: () => any;
      subscribe: (listener: () => void) => () => void;
    };
    __luckyAllAroundInstalled?: boolean;
    __luckyAllAroundX6Installed?: boolean;
    luckyAllAroundDebug?: LuckyAllAroundDebugApi;
    luckyAllAroundX6Debug?: LuckyAllAroundX6DebugApi;
  }
}

export {};
