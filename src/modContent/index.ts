type LooseRecord = Record<string, any>;

type StoreLike = {
  dispatch: (action: any) => any;
  getState: () => LooseRecord;
};

type GameModule = {
  B: new (seed?: string) => {
    next: (min: number, max: number) => number;
    nextInt: (min: number, max: number) => number;
  };
  a7: (payload: { flag: string; value: number }) => any;
  aC: (days: number) => any;
  aV: (payload: { location: string; amount: number }) => any;
  aW: (location: any, unlock: any) => string;
  aX: (payload: { character: string; id: string; cooldown: number }) => any;
  ba: Record<string, any>;
  bl: any[];
  bn: (condition: string, flags: LooseRecord) => boolean;
  v: (payload: { player: any; gameEvent: any; quest?: any }) => any;
  w: () => any;
  x: (
    gameData: any,
    player: any,
    inventory: any,
    gameEvent: any,
    calendar: any,
    breakthrough: any,
    fallenStar: any,
    globalFlags: any,
    characters: any,
  ) => LooseRecord;
  y: () => LooseRecord;
};

type WeightedOutcome = {
  index: number;
  event: any;
};

const MOD_TAG = '[LuckyAllAround-x6]';
const EXPLORE_PREFIX = 'Explore';
const FIXED_PITY_MULTIPLIER = 6;
const DEFAULT_UNLOCK_EXPLORATION_COUNT = 3;
const CHARACTER_ENCOUNTER_CHANCE = 0.75;
const RARITIES = [
  'mundane',
  'qitouched',
  'empowered',
  'resplendent',
  'incandescent',
  'transcendent',
];

let allowNextNativeExploreClick = false;
let explorationRng: InstanceType<GameModule['B']> | null = null;
let cachedGameModulePromise: Promise<GameModule> | null = null;

function log(message: string, ...args: unknown[]) {
  console.log(MOD_TAG, message, ...args);
}

function runtimeImport<T>(specifier: string): Promise<T> {
  return (0, eval)(`import(${JSON.stringify(specifier)})`) as Promise<T>;
}

function getGameModule(): Promise<GameModule> {
  if (!cachedGameModulePromise) {
    const moduleUrl = new URL('./Game.js', window.location.href).href;

    cachedGameModulePromise = runtimeImport<GameModule>(moduleUrl).then(
      (gameModule) => {
        explorationRng = new gameModule.B();
        log('Loaded runtime Game.js module');
        return gameModule;
      },
    );
  }

  return cachedGameModulePromise;
}

function getStore(): StoreLike | null {
  if (!window.gameStore?.dispatch || !window.gameStore.getState) {
    return null;
  }

  return window.gameStore as StoreLike;
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

function evaluateCondition(
  gameModule: GameModule,
  condition: string | undefined,
  flags: LooseRecord,
): boolean {
  if (!condition) {
    return true;
  }

  return Boolean(gameModule.bn(condition, flags));
}

function findLastMatch<T>(
  values: T[] | undefined,
  predicate: (value: T) => boolean,
): T | undefined {
  if (!values) {
    return undefined;
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];

    if (predicate(value)) {
      return value;
    }
  }

  return undefined;
}

function getFlagKey(value: string): string {
  return window.modAPI?.utils?.flag?.(value) ?? value.replace(/[^\w]/g, '_');
}

function getFullItem(item: any): any {
  return window.modAPI?.utils?.getFullItem?.(item) ?? item;
}

function getExplorationAmount(player: any): number {
  let explorationBonus = 0;

  if (player?.mount) {
    const mount = getFullItem(player.mount);

    if (mount?.kind === 'mount') {
      explorationBonus += mount.explorationBonus ?? 0;
      explorationBonus += mount.enchantment?.explorationBonus ?? 0;
    }
  }

  return 1 + explorationBonus;
}

function getRarityWeight(rarity: string): number {
  return RARITIES.length - RARITIES.indexOf(rarity);
}

function buildFlagsSnapshot(
  gameModule: GameModule,
  state: LooseRecord,
): LooseRecord {
  return gameModule.x(
    state.gameData,
    state.player?.player,
    state.inventory,
    state.gameEvent,
    state.calendar,
    state.breakthrough,
    state.fallenStar,
    gameModule.y(),
    state.characters,
  );
}

function getCurrentQuestStep(
  gameModule: GameModule,
  questState: any,
  flags: LooseRecord,
  questDefinitions: Record<string, any>,
): number {
  const definition = questDefinitions[questState.name];

  if (!definition) {
    return -1;
  }

  let currentStepIndex = 0;

  for (let index = 0; index < definition.steps.length; index += 1) {
    const step = definition.steps[index];

    if (
      (step.kind === 'event' ||
        step.kind === 'speakToCharacter' ||
        step.kind === 'wait') &&
      questState.completed?.includes(index)
    ) {
      currentStepIndex = index;
    }
  }

  while (currentStepIndex < definition.steps.length) {
    const step = definition.steps[currentStepIndex];

    if (step.kind === 'condition') {
      if (!evaluateCondition(gameModule, step.completionCondition, flags)) {
        break;
      }
    } else if (step.kind === 'collect') {
      if (!(step.completionCondition && evaluateCondition(gameModule, step.completionCondition, flags))) {
        let currentAmount = flags[getFlagKey(step.item)] ?? 0;

        for (const alternate of step.alternates ?? []) {
          currentAmount += flags[getFlagKey(alternate)] ?? 0;
        }

        if (currentAmount < step.amount) {
          break;
        }
      }
    } else if (step.kind === 'event' || step.kind === 'speakToCharacter') {
      if (step.completionCondition) {
        if (!evaluateCondition(gameModule, step.completionCondition, flags)) {
          break;
        }
      } else if (!questState.completed?.includes(currentStepIndex)) {
        break;
      }
    } else {
      if (step.kind === 'missionHall') {
        break;
      }

      if (step.kind === 'flagValue') {
        if ((flags[step.flag] ?? 0) < step.value) {
          break;
        }
      } else if (step.kind === 'kill') {
        if ((questState.killTally?.[step.enemy] ?? 0) < step.amount) {
          break;
        }
      } else if (step.kind === 'wait') {
        if (
          (questState.waitMonths?.[currentStepIndex] ?? 0) < step.months &&
          !questState.completed?.includes(currentStepIndex)
        ) {
          break;
        }
      } else if (
        step.kind === 'raid' &&
        (questState.raidsComplete ?? 0) < step.amount
      ) {
        break;
      }
    }

    currentStepIndex += 1;
  }

  return currentStepIndex;
}

function getActiveKillQuestEnemies(
  gameModule: GameModule,
  state: LooseRecord,
  flags: LooseRecord,
): Set<string> {
  const questDefinitions = window.modAPI?.gameData?.quests ?? {};
  const activeEnemies = new Set<string>();

  for (const questState of state.quests?.quests ?? []) {
    const definition = questDefinitions[questState.name];

    if (!definition) {
      continue;
    }

    let currentStepIndex = getCurrentQuestStep(
      gameModule,
      questState,
      flags,
      questDefinitions,
    );

    if (currentStepIndex >= definition.steps.length) {
      currentStepIndex = definition.steps.length - 1;
    }

    const step = definition.steps[currentStepIndex];

    if (step?.kind === 'kill' && step.enemy) {
      activeEnemies.add(step.enemy);
    }
  }

  return activeEnemies;
}

function resolveCharacterLocation(
  gameModule: GameModule,
  character: any,
  characterState: any,
  flags: LooseRecord,
  isFollowing: boolean,
  currentLocation: string,
  fallenStar: any,
): string {
  if (isFollowing) {
    return currentLocation;
  }

  const relationshipPath = characterState.relationshipPath;
  const relationships =
    relationshipPath && character.relationshipPaths?.[relationshipPath]
      ? character.relationshipPaths[relationshipPath]
      : character.relationship ?? [];

  if (relationships.length > 0) {
    const relationship = relationships[characterState.relationshipIndex];

    if (
      relationship &&
      characterState.approval >= relationship.requiredApproval &&
      (!relationship.progressionEvent?.requirement ||
        evaluateCondition(
          gameModule,
          relationship.progressionEvent.requirement.condition,
          flags,
        )) &&
      relationship.progressionEvent.locationOverride
    ) {
      return relationship.progressionEvent.locationOverride;
    }
  }

  const locationDefinition = findLastMatch<any>(
    character.definitions?.[characterState.defIndex]?.locations,
    (location) => evaluateCondition(gameModule, location.condition, flags),
  );

  if (!locationDefinition) {
    return '';
  }

  switch (locationDefinition.kind) {
    case 'wander':
      return (
        locationDefinition.route?.[characterState.locationCycleIndex ?? 0]
          ?.location ?? ''
      );

    case 'random':
      return (
        locationDefinition.locations?.[characterState.locationCycleIndex ?? 0]
          ?.location ?? ''
      );

    case 'static':
      return locationDefinition.location ?? '';

    case 'star': {
      let highestThreat = 0;
      let lowestThreat = 100;
      let resolvedLocation = '';
      const matchingLocations: string[] = [];

      for (const [name, site] of Object.entries(
        fallenStar?.activeSites ?? {},
      )) {
        const threat = (site as any)?.remainingThreatPercentage ?? 0;

        if (locationDefinition.mode === 'highest') {
          if (highestThreat < threat) {
            highestThreat = threat;
            resolvedLocation = name;
          }
        } else if (locationDefinition.mode === 'more' && locationDefinition.percentage) {
          if (locationDefinition.percentage <= threat) {
            matchingLocations.push(name);
            resolvedLocation = matchingLocations[matchingLocations.length - 1];
          }
        } else if (locationDefinition.mode === 'less' && locationDefinition.percentage) {
          if (locationDefinition.percentage >= threat) {
            matchingLocations.push(name);
            resolvedLocation = matchingLocations[matchingLocations.length - 1];
          }
        } else if (lowestThreat > threat) {
          lowestThreat = threat;
          resolvedLocation = name;
        }
      }

      if (!resolvedLocation) {
        resolvedLocation = locationDefinition.fallbackLocation ?? '';
      }

      return resolvedLocation;
    }

    default:
      return '';
  }
}

function startEvent(
  dispatch: StoreLike['dispatch'],
  gameModule: GameModule,
  player: any,
  gameEvent: any,
  quest?: any,
) {
  dispatch(gameModule.v({ player, gameEvent, quest }));
  dispatch(gameModule.w());
}

function maybeStartCharacterEncounter(
  dispatch: StoreLike['dispatch'],
  gameModule: GameModule,
  state: LooseRecord,
  flags: LooseRecord,
  locationName: string,
): boolean {
  const charactersState = state.characters;
  const encounterRng = new gameModule.B();

  if (
    (charactersState?.globalEncounterCooldown ?? 0) > 0 ||
    encounterRng.next(0, 1) > CHARACTER_ENCOUNTER_CHANCE
  ) {
    return false;
  }

  for (const character of gameModule.bl ?? []) {
    if (
      !character.definitions?.length ||
      !evaluateCondition(gameModule, character.condition, flags)
    ) {
      continue;
    }

    const characterState = charactersState?.characterData?.[character.name];

    if (!characterState || characterState.didEncounter || characterState.beaten) {
      continue;
    }

    const resolvedLocation = resolveCharacterLocation(
      gameModule,
      character,
      characterState,
      flags,
      charactersState?.followingCharacter === character.name,
      locationName,
      state.fallenStar,
    );

    if (resolvedLocation !== locationName) {
      continue;
    }

    const definition = character.definitions[characterState.defIndex];

    if (!definition) {
      continue;
    }

    const encounterAvailable = (encounter: any) =>
      !characterState.encounterCooldowns?.[encounter.id] &&
      (!encounter.locations || encounter.locations.includes(locationName)) &&
      evaluateCondition(gameModule, encounter.condition, flags);

    const launchEncounter = (encounter: any, isBreakthroughEncounter = false) => {
      const cooldown = encounter.cooldown
        ? encounterRng.nextInt(encounter.cooldown.min, encounter.cooldown.max)
        : 999999;

      dispatch(
        gameModule.aX({
          character: character.name,
          id: encounter.id,
          cooldown,
        }),
      );
      startEvent(dispatch, gameModule, state.player.player, {
        location: locationName,
        steps: encounter.event,
      });
      dispatch({ type: 'characters/setGlobalEncounterCooldown' });

      if (isBreakthroughEncounter) {
        dispatch({
          type: 'characters/setBreakthroughEncounterDone',
          payload: character.name,
        });
      }
    };

    if (
      !characterState.doneBreakthroughEncounter &&
      definition.breakthroughEncounter &&
      encounterAvailable(definition.breakthroughEncounter)
    ) {
      launchEncounter(definition.breakthroughEncounter, true);
      return true;
    }

    if (definition.kind !== 'enemy' || !characterState.beaten) {
      const availableEncounters = (definition.encounters ?? []).filter(
        encounterAvailable,
      );

      if (availableEncounters.length > 0) {
        const encounter =
          availableEncounters[
            encounterRng.nextInt(0, availableEncounters.length - 1)
          ];
        launchEncounter(encounter);
        return true;
      }
    }
  }

  return false;
}

function buildWeightedOutcomes(
  gameModule: GameModule,
  state: LooseRecord,
  flags: LooseRecord,
  location: any,
): { outcomes: WeightedOutcome[]; sawPityEvent: boolean } {
  const outcomes: WeightedOutcome[] = [];
  let sawPityEvent = false;
  const player = state.player.player;
  const activeKillQuestEnemies = getActiveKillQuestEnemies(gameModule, state, flags);
  const lastEvent = state.location?.currentLocationLastEvent;
  const lastEventCount = state.location?.currentLocationLastEventCount ?? 0;
  const pityProgress = Number(flags.globalSpecialEventPity ?? 0);
  const pityProgressMultiplier = Math.min(1 + pityProgress * 0.1, 5);
  const playerName = `${player.forename} ${player.surname}`;

  for (let index = 0; index < (location.events ?? []).length; index += 1) {
    const event = location.events[index];

    if (!evaluateCondition(gameModule, event.condition, flags)) {
      continue;
    }

    if (event.cooldown) {
      const cooldownEnd = Number(flags[event.cooldown.key] ?? 0);

      if (Number(flags.month ?? 0) < cooldownEnd) {
        continue;
      }
    }

    let weight = getRarityWeight(event.rarity);

    if (event.pity) {
      sawPityEvent = true;
      weight = Math.max(1, Math.ceil(weight * FIXED_PITY_MULTIPLIER));
      weight = Math.ceil(weight * pityProgressMultiplier);
    }

    if (index === lastEvent) {
      weight -= lastEventCount;
    }

    for (let count = 0; count < weight; count += 1) {
      outcomes.push({ index, event });
    }
  }

  for (let index = 0; index < (location.enemies ?? []).length; index += 1) {
    const enemy = location.enemies[index];

    if (!evaluateCondition(gameModule, enemy.condition, flags)) {
      continue;
    }

    const combatEvent = window.modAPI?.utils?.createCombatEvent?.(enemy);

    if (!combatEvent) {
      continue;
    }

    let weight = getRarityWeight(combatEvent.rarity);

    if (activeKillQuestEnemies.has(enemy.enemy?.name)) {
      weight = Math.ceil(weight * 1.5);
    }

    const outcomeIndex = index + 100;

    if (outcomeIndex === lastEvent) {
      weight -= lastEventCount;
    }

    if ((location.enemies ?? []).length === 1) {
      weight = 1;
    }

    for (let count = 0; count < weight; count += 1) {
      outcomes.push({ index: outcomeIndex, event: combatEvent });
    }
  }

  void playerName;

  return { outcomes, sawPityEvent };
}

function handleExploreClick(
  dispatch: StoreLike['dispatch'],
  gameModule: GameModule,
  state: LooseRecord,
): boolean {
  const player = state.player?.player;
  const locationName = state.location?.current;
  const location = locationName ? gameModule.ba?.[locationName] : undefined;

  if (!player || !locationName || !location) {
    return false;
  }

  if (state.gameEvent?.gameEvent) {
    return false;
  }

  const flags = buildFlagsSnapshot(gameModule, state);
  const visitedLocations = new Set<string>(state.location?.visited ?? []);
  const explorationCount = state.gameData?.mapExploration?.[locationName] ?? 0;
  const explorationAmount = getExplorationAmount(player);

  dispatch(gameModule.aC(1));

  const explorationEvent = (location.explorationEvent ?? []).find((entry: any) =>
    Boolean(gameModule.bn(entry.condition, flags)),
  );

  if (explorationEvent) {
    startEvent(dispatch, gameModule, player, {
      location: locationName,
      steps: explorationEvent.event,
    });
    return true;
  }

  const unlocks = (location.unlocks ?? [])
    .filter((unlock: any) => !visitedLocations.has(unlock.location.name))
    .filter(
      (unlock: any) =>
        !unlock.condition || evaluateCondition(gameModule, unlock.condition, flags),
    )
    .filter((unlock: any) => Boolean(unlock.exploration))
    .sort((left: any, right: any) => left.exploration - right.exploration);

  if (
    unlocks.length > 0 &&
    explorationCount >=
      (location.explorationCountOverride ?? DEFAULT_UNLOCK_EXPLORATION_COUNT)
  ) {
    const unlock = unlocks[0];

    dispatch({ type: 'gameData/resetExploration', payload: locationName });
    dispatch(
      gameModule.a7({
        flag: gameModule.aW(location, unlock),
        value: 1,
      }),
    );
    startEvent(dispatch, gameModule, player, {
      location: locationName,
      steps: unlock.event,
    });
    return true;
  }

  if (
    maybeStartCharacterEncounter(
      dispatch,
      gameModule,
      state,
      flags,
      locationName,
    )
  ) {
    dispatch(
      gameModule.aV({
        location: locationName,
        amount: explorationAmount,
      }),
    );
    return true;
  }

  const { outcomes, sawPityEvent } = buildWeightedOutcomes(
    gameModule,
    state,
    flags,
    location,
  );

  if (outcomes.length === 0) {
    log('No valid exploration outcomes were generated');
    return false;
  }

  if (!explorationRng) {
    explorationRng = new gameModule.B();
  }

  const chosen =
    outcomes[explorationRng.nextInt(0, outcomes.length - 1)];
  const pityProgress = Number(flags.globalSpecialEventPity ?? 0);

  if (chosen.event.pity) {
    dispatch(gameModule.a7({ flag: 'globalSpecialEventPity', value: 0 }));
  } else if (sawPityEvent) {
    dispatch(
      gameModule.a7({
        flag: 'globalSpecialEventPity',
        value: pityProgress + 1,
      }),
    );
  }

  if (chosen.event.cooldown) {
    const cooldownMonths = explorationRng.nextInt(
      chosen.event.cooldown.min,
      chosen.event.cooldown.max,
    );

    dispatch(
      gameModule.a7({
        flag: chosen.event.cooldown.key,
        value: Number(flags.month ?? 0) + cooldownMonths,
      }),
    );
  }

  dispatch({
    type: 'location/markCurrentLocationEvent',
    payload: chosen.index,
  });
  dispatch(
    gameModule.aV({
      location: locationName,
      amount: explorationAmount,
    }),
  );
  startEvent(dispatch, gameModule, player, {
    location: locationName,
    steps: chosen.event.event,
  });
  return true;
}

async function onDocumentClick(event: MouseEvent) {
  const button = getExploreButton(event.target);

  if (!button) {
    return;
  }

  if (allowNextNativeExploreClick) {
    allowNextNativeExploreClick = false;
    return;
  }

  const store = getStore();

  if (!store) {
    return;
  }

  const state = store.getState();

  if (!state?.location?.current || state?.gameEvent?.gameEvent) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  try {
    const gameModule = await getGameModule();
    const handled = handleExploreClick(store.dispatch, gameModule, state);

    if (!handled) {
      allowNextNativeExploreClick = true;
      queueMicrotask(() => {
        button.click();
      });
    }
  } catch (error) {
    console.error(MOD_TAG, 'Custom explore handler failed, falling back to native click', error);
    allowNextNativeExploreClick = true;
    queueMicrotask(() => {
      button.click();
    });
  }
}

function install() {
  if (window.__luckyAllAroundX6Installed) {
    return;
  }

  window.__luckyAllAroundX6Installed = true;
  void getGameModule().catch((error) => {
    console.error(MOD_TAG, 'Unable to preload Game.js runtime module', error);
  });
  document.addEventListener('click', (event) => {
    void onDocumentClick(event);
  }, true);
  log('Installed explore luck override');
}

install();
