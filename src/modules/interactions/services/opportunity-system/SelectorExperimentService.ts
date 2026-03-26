import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FocusSelectorOptions } from './FocusSelectorService';
import { DEFAULT_SELECTION_CONFIG } from './scoring/score-types';

const SELECTOR_EXPERIMENT_CONFIG_KEY = '@weave:selector_experiment_config';

export type ThresholdExperimentVariant = 'control' | 'relaxed' | 'strict';
export type CopyExperimentVariant = 'control' | 'concise' | 'why-now' | 'premium';

export interface SelectorExperimentConfig {
  thresholdVariant: ThresholdExperimentVariant;
  copyVariant: CopyExperimentVariant;
  updatedAt: number;
}

export const DEFAULT_SELECTOR_EXPERIMENT_CONFIG: SelectorExperimentConfig = {
  thresholdVariant: 'control',
  copyVariant: 'control',
  updatedAt: 0,
};

let cachedConfig: SelectorExperimentConfig | null = null;

function normalizeThresholdVariant(value?: string | null): ThresholdExperimentVariant {
  if (value === 'relaxed' || value === 'strict') {
    return value;
  }

  return 'control';
}

function normalizeCopyVariant(value?: string | null): CopyExperimentVariant {
  if (value === 'concise' || value === 'why-now' || value === 'premium') {
    return value;
  }

  return 'control';
}

export function normalizeSelectorExperimentConfig(
  value: unknown
): SelectorExperimentConfig {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SELECTOR_EXPERIMENT_CONFIG };
  }

  const record = value as Partial<Record<keyof SelectorExperimentConfig, unknown>>;
  return {
    thresholdVariant: normalizeThresholdVariant(
      typeof record.thresholdVariant === 'string' ? record.thresholdVariant : undefined
    ),
    copyVariant: normalizeCopyVariant(
      typeof record.copyVariant === 'string' ? record.copyVariant : undefined
    ),
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
  };
}

function getThresholdDelta(variant: ThresholdExperimentVariant): number {
  switch (variant) {
    case 'relaxed':
      return -5;
    case 'strict':
      return 5;
    default:
      return 0;
  }
}

export function applySelectorExperimentToOptions(
  options: FocusSelectorOptions = {},
  config?: SelectorExperimentConfig
): FocusSelectorOptions {
  const effectiveConfig = config || DEFAULT_SELECTOR_EXPERIMENT_CONFIG;
  const baseSelectionConfig = options.selectionConfig || DEFAULT_SELECTION_CONFIG;
  return {
    ...options,
    selectionConfig: {
      ...baseSelectionConfig,
      minThreshold: Math.max(0, baseSelectionConfig.minThreshold + getThresholdDelta(effectiveConfig.thresholdVariant)),
    },
  };
}

export function clearSelectorExperimentCache(): void {
  cachedConfig = null;
}

async function loadConfigFromStorage(): Promise<SelectorExperimentConfig> {
  try {
    const rawValue = await AsyncStorage.getItem(SELECTOR_EXPERIMENT_CONFIG_KEY);
    if (!rawValue) {
      return { ...DEFAULT_SELECTOR_EXPERIMENT_CONFIG };
    }

    return normalizeSelectorExperimentConfig(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_SELECTOR_EXPERIMENT_CONFIG };
  }
}

export const SelectorExperimentService = {
  async getConfig(): Promise<SelectorExperimentConfig> {
    if (cachedConfig) {
      return cachedConfig;
    }

    cachedConfig = await loadConfigFromStorage();
    return cachedConfig;
  },

  getCachedConfig(): SelectorExperimentConfig {
    return cachedConfig || { ...DEFAULT_SELECTOR_EXPERIMENT_CONFIG };
  },

  async saveConfig(
    partial: Partial<Omit<SelectorExperimentConfig, 'updatedAt'>>
  ): Promise<SelectorExperimentConfig> {
    const current = await this.getConfig();
    const next = normalizeSelectorExperimentConfig({
      ...current,
      ...partial,
      updatedAt: Date.now(),
    });

    cachedConfig = next;
    await AsyncStorage.setItem(SELECTOR_EXPERIMENT_CONFIG_KEY, JSON.stringify(next));
    return next;
  },

  async reset(): Promise<SelectorExperimentConfig> {
    cachedConfig = { ...DEFAULT_SELECTOR_EXPERIMENT_CONFIG, updatedAt: Date.now() };
    await AsyncStorage.setItem(SELECTOR_EXPERIMENT_CONFIG_KEY, JSON.stringify(cachedConfig));
    return cachedConfig;
  },

  clearCache(): void {
    clearSelectorExperimentCache();
  },
};
