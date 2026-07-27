import type { ModOptionsFC } from 'afnm-types';
import { getRuntimeConfig, updateRuntimeConfig } from './config';
import { getCompatibilitySummary } from './diagnostics';
import {
  MAX_PITY_MULTIPLIER,
  MAX_RARITY_MULTIPLIER,
  MIN_PITY_MULTIPLIER,
  MIN_RARITY_MULTIPLIER,
  type JsonRecord,
  type RuntimeConfig,
} from './logic';

type CreateElement = (...args: unknown[]) => unknown;

function text(
  createElement: CreateElement,
  key: string,
  value: string,
  style?: JsonRecord,
): unknown {
  return createElement('div', { key, style }, value);
}

function slider(
  createElement: CreateElement,
  key: string,
  label: string,
  min: number,
  max: number,
  value: number,
  onChange: (value: number) => void,
): unknown {
  return createElement(
    'label',
    { key, style: { display: 'grid', gap: '6px' } },
    [
      text(createElement, `${key}-label`, `${label}: ${value}x`, {
        fontWeight: 600,
      }),
      createElement('input', {
        key: `${key}-input`,
        type: 'range',
        min,
        max,
        step: 1,
        value,
        onChange: (event: Event) =>
          onChange(Number((event.target as HTMLInputElement | null)?.value)),
        style: { width: '100%' },
      }),
    ],
  );
}

export const LuckyAllAroundOptions: ModOptionsFC = ({ api }) => {
  const ReactRuntime = window.React;
  if (
    !ReactRuntime?.createElement ||
    !ReactRuntime.useEffect ||
    !ReactRuntime.useState
  ) {
    throw new Error('React runtime unavailable for options UI');
  }

  const createElement = ReactRuntime.createElement.bind(ReactRuntime);
  const [config, setConfig] =
    ReactRuntime.useState<RuntimeConfig>(getRuntimeConfig());
  const GameButton = api.components.GameButton ?? 'button';
  ReactRuntime.useEffect(() => setConfig(getRuntimeConfig()), []);

  const apply = (partial: Partial<RuntimeConfig>) =>
    setConfig(updateRuntimeConfig(partial));
  const modeDescription =
    config.mode === 'force'
      ? `Force mode replaces every native pity tier with ${config.multiplier}x.`
      : `Never Worse keeps native tiers above ${config.multiplier}x and raises lower tiers.`;
  const raritySliders = (
    [
      ['empoweredMultiplier', 'Empowered event multiplier'],
      ['resplendentMultiplier', 'Resplendent event multiplier'],
      ['incandescentMultiplier', 'Incandescent event multiplier'],
      ['transcendentMultiplier', 'Transcendent event multiplier'],
    ] as const
  ).map(([key, label]) =>
    slider(
      createElement,
      key,
      label,
      MIN_RARITY_MULTIPLIER,
      MAX_RARITY_MULTIPLIER,
      config[key],
      (value) => apply({ [key]: value }),
    ),
  );

  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '8px 4px',
        overflow: 'auto',
        maxHeight: '100%',
      },
    },
    [
      text(createElement, 'pity-title', 'Exclusive Event Options', {
        fontWeight: 700,
        fontSize: '1.2rem',
      }),
      createElement(
        'div',
        { key: 'mode-buttons', style: { display: 'flex', gap: '12px' } },
        [
          createElement(
            GameButton,
            { key: 'force', onClick: () => apply({ mode: 'force' }) },
            config.mode === 'force' ? 'Force selected' : 'Use Force',
          ),
          createElement(
            GameButton,
            {
              key: 'never-worse',
              onClick: () => apply({ mode: 'neverWorse' }),
            },
            config.mode === 'neverWorse'
              ? 'Never Worse selected'
              : 'Use Never Worse',
          ),
        ],
      ),
      slider(
        createElement,
        'pity-multiplier',
        'Luck multiplier',
        MIN_PITY_MULTIPLIER,
        MAX_PITY_MULTIPLIER,
        config.multiplier,
        (value) => apply({ multiplier: value }),
      ),
      text(createElement, 'mode-description', modeDescription, {
        opacity: 0.85,
      }),
      text(createElement, 'rarity-title', 'Rare Event Luck Boosts', {
        fontWeight: 700,
        fontSize: '1.2rem',
      }),
      ...raritySliders,
      text(
        createElement,
        'compatibility',
        getCompatibilitySummary(),
        { opacity: 0.8, fontSize: '0.9rem' },
      ),
    ],
  );
};

export function installOptionsUi(): void {
  window.modAPI?.actions?.registerOptionsUI?.(LuckyAllAroundOptions);
}
