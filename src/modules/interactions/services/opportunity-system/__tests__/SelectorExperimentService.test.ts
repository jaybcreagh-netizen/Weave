import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SelectorExperimentService,
  applySelectorExperimentToOptions,
  clearSelectorExperimentCache,
  normalizeSelectorExperimentConfig,
} from '../SelectorExperimentService';

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('SelectorExperimentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSelectorExperimentCache();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  it('normalizes persisted config safely', () => {
    expect(normalizeSelectorExperimentConfig({
      thresholdVariant: 'strict',
      copyVariant: 'premium',
      updatedAt: 123,
    })).toEqual({
      thresholdVariant: 'strict',
      copyVariant: 'premium',
      updatedAt: 123,
    });

    expect(normalizeSelectorExperimentConfig({
      thresholdVariant: 'weird',
      copyVariant: 'mystery',
    })).toEqual({
      thresholdVariant: 'control',
      copyVariant: 'control',
      updatedAt: 0,
    });
  });

  it('applies threshold experiment variants to selector options', () => {
    expect(applySelectorExperimentToOptions({
      selectionConfig: {
        minThreshold: 35,
        secondaryRatio: 0.6,
      },
    }, {
      thresholdVariant: 'strict',
      copyVariant: 'control',
      updatedAt: 0,
    }).selectionConfig).toEqual({
      minThreshold: 40,
      secondaryRatio: 0.6,
    });

    expect(applySelectorExperimentToOptions({
      selectionConfig: {
        minThreshold: 35,
        secondaryRatio: 0.6,
      },
    }, {
      thresholdVariant: 'relaxed',
      copyVariant: 'control',
      updatedAt: 0,
    }).selectionConfig).toEqual({
      minThreshold: 30,
      secondaryRatio: 0.6,
    });
  });

  it('loads, caches, and saves selector experiment config', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      thresholdVariant: 'relaxed',
      copyVariant: 'concise',
      updatedAt: 10,
    }));

    const firstConfig = await SelectorExperimentService.getConfig();
    const secondConfig = await SelectorExperimentService.getConfig();
    const savedConfig = await SelectorExperimentService.saveConfig({
      thresholdVariant: 'strict',
    });

    expect(firstConfig).toEqual({
      thresholdVariant: 'relaxed',
      copyVariant: 'concise',
      updatedAt: 10,
    });
    expect(secondConfig).toEqual(firstConfig);
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(savedConfig.thresholdVariant).toBe('strict');
    expect(savedConfig.copyVariant).toBe('concise');
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      '@weave:selector_experiment_config',
      expect.any(String)
    );
  });
});
