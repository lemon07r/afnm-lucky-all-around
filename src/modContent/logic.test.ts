import { describe, expect, test } from 'bun:test';
import {
  buildEventAdjustment,
  buildShuffledIndexes,
  getAppliedMultiplier,
  getVanillaPityMultiplier,
  hashPlayerName,
  type RuntimeConfig,
} from './logic';
import { beginExplorePatch } from './interceptor';

const config: RuntimeConfig = {
  mode: 'force',
  multiplier: 6,
  empoweredMultiplier: 1,
  resplendentMultiplier: 1,
  incandescentMultiplier: 1,
  transcendentMultiplier: 1,
};

(globalThis as unknown as { MOD_METADATA: typeof MOD_METADATA }).MOD_METADATA = {
  name: 'afnm-lucky-all-around',
  version: '1.4.0',
  author: { name: 'test' },
  description: 'test',
  gameVersion: '0.7.6',
};

describe('0.7.6 Explore weighting', () => {
  test('player-name tier assignment is deterministic', () => {
    const conditions = ['a', 'b', 'c', 'd', 'e'];
    expect(hashPlayerName('Lin Yue')).toBe(hashPlayerName('Lin Yue'));
    expect(buildShuffledIndexes(5, hashPlayerName('Lin Yue'))).toEqual(
      buildShuffledIndexes(5, hashPlayerName('Lin Yue')),
    );
    expect(getVanillaPityMultiplier('c', 'Lin Yue', conditions)).toBe(
      getVanillaPityMultiplier('c', 'Lin Yue', conditions),
    );
  });

  test('force and never-worse modes retain their public semantics', () => {
    expect(getAppliedMultiplier(10, config)).toBe(6);
    expect(
      getAppliedMultiplier(10, { ...config, mode: 'neverWorse' }),
    ).toBe(10);
    expect(
      getAppliedMultiplier(2, { ...config, mode: 'neverWorse' }),
    ).toBe(6);
  });

  test('pity progression expands slots before repeat subtraction', () => {
    const adjusted = buildEventAdjustment(
      { condition: 'special', pity: true, rarity: 'transcendent' } as never,
      3,
      {
        config,
        playerName: 'Lin Yue',
        pityProgressMultiplier: 2,
        lastEventIndex: 3,
        lastEventCount: 2,
        allPityConditions: ['special'],
      },
    );
    expect(adjusted).not.toBeNull();
    expect(adjusted!.adjustedCount).toBe(10);
    expect(adjusted!.nativeCount).toBe(18);
  });
});

test('interceptor restoration restores Array.prototype.push', () => {
  const originalPush = Array.prototype.push;
  const restore = beginExplorePatch({
    startedAt: new Date(0).toISOString(),
    playerName: 'Lin Yue',
    locationName: 'test',
    pityProgress: 0,
    pityProgressMultiplier: 1,
    lastEventIndex: null,
    lastEventCount: 0,
    config,
    adjustments: [],
    adjustmentsByKey: new Map(),
    pushTrackingByKey: new Map(),
  });
  expect(Array.prototype.push).not.toBe(originalPush);
  restore();
  expect(Array.prototype.push).toBe(originalPush);
});

test('interceptor ignores unrelated indexed objects', () => {
  const originalPush = Array.prototype.push;
  const restore = beginExplorePatch({
    startedAt: new Date(0).toISOString(),
    playerName: 'Lin Yue',
    locationName: 'test',
    pityProgress: 0,
    pityProgressMultiplier: 1,
    lastEventIndex: null,
    lastEventCount: 0,
    config,
    adjustments: [],
    adjustmentsByKey: new Map(),
    pushTrackingByKey: new Map(),
  });
  const unrelated: Array<{ index: number }> = [];
  expect(() => unrelated.push({ index: 1 })).not.toThrow();
  expect(unrelated).toEqual([{ index: 1 }]);
  restore();
  expect(Array.prototype.push).toBe(originalPush);
});
