import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { ModAPI } from 'afnm-types';
import {
  ensureNormalizedRuntimeConfig,
  FLAG_KEYS,
  getRuntimeConfigFromFlags,
} from './config';
import { normalizeMode } from './logic';

afterEach(() => {
  delete (globalThis as Partial<{ window: Window }>).window;
});

describe('persisted Lucky All Around configuration', () => {
  test('migrates legacy flags and writes every normalized key', () => {
    const setGlobalFlag = mock(() => undefined);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        modAPI: {
          actions: {
            getGlobalFlags: () => ({
              'luckyAllAroundX6.mode': '1',
              'luckyAllAroundX6.multiplier': 12,
            }),
            setGlobalFlag,
          },
        } as unknown as ModAPI,
      } as Window,
    });

    ensureNormalizedRuntimeConfig();

    expect(setGlobalFlag).toHaveBeenCalledTimes(6);
    expect(setGlobalFlag).toHaveBeenCalledWith(FLAG_KEYS.mode, 1);
    expect(setGlobalFlag).toHaveBeenCalledWith(FLAG_KEYS.multiplier, 10);
    expect(setGlobalFlag).toHaveBeenCalledWith(
      FLAG_KEYS.empoweredMultiplier,
      1,
    );
  });

  test('rounds and clamps invalid or out-of-range multipliers', () => {
    expect(
      getRuntimeConfigFromFlags({
        [FLAG_KEYS.multiplier]: 3.6,
        [FLAG_KEYS.empoweredMultiplier]: 0,
        [FLAG_KEYS.resplendentMultiplier]: 99,
        [FLAG_KEYS.incandescentMultiplier]: 'invalid',
        [FLAG_KEYS.transcendentMultiplier]: 7.5,
      }),
    ).toEqual({
      mode: 'force',
      multiplier: 4,
      empoweredMultiplier: 1,
      resplendentMultiplier: 10,
      incandescentMultiplier: 1,
      transcendentMultiplier: 8,
    });
  });

  test('normalizes legacy mode representations', () => {
    expect(normalizeMode(1)).toBe('neverWorse');
    expect(normalizeMode('1')).toBe('neverWorse');
    expect(normalizeMode(true)).toBe('neverWorse');
    expect(normalizeMode(0)).toBe('force');
    expect(normalizeMode('force')).toBe('force');
  });
});
