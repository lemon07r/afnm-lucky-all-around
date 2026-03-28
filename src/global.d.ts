declare const MOD_METADATA: {
  name: string;
  version: string;
  author: { name: string };
  description: string;
  gameVersion?: string;
};

declare global {
  interface Window {
    modAPI?: {
      gameData?: {
        quests?: Record<string, any>;
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
    __luckyAllAroundX6Installed?: boolean;
  }
}

export {};
