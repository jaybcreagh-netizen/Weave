import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent, AnalyticsEvents, setUserProperties } from '@/shared/services/analytics.service';

interface TutorialState {
  // Onboarding completion flags
  hasCompletedOnboarding: boolean;
  hasAddedFirstFriend: boolean;
  hasSeenQuickWeaveIntro: boolean;
  hasPerformedQuickWeave: boolean;
  hasSeenIntentionIntro: boolean;
  hasSetIntention: boolean;
  hasSeenPlanIntro: boolean;
  hasCreatedPlan: boolean;
  hasSeenTodaysFocus: boolean;
  hasSeenSocialBattery: boolean;
  hasSeenInsightsTab: boolean;
  hasSeenQuizPrompt: boolean;
  hasTakenQuiz: boolean;

  // Helper
  persistState: (updates: Partial<TutorialState>) => Promise<void>;

  // Actions
  completeOnboarding: () => Promise<void>;
  markFirstFriendAdded: () => Promise<void>;
  markQuickWeaveIntroSeen: () => Promise<void>;
  markQuickWeavePerformed: () => Promise<void>;
  markIntentionIntroSeen: () => Promise<void>;
  markIntentionSet: () => Promise<void>;
  markPlanIntroSeen: () => Promise<void>;
  markPlanCreated: () => Promise<void>;
  markTodaysFocusSeen: () => Promise<void>;
  markSocialBatterySeen: () => Promise<void>;
  markInsightsTabSeen: () => Promise<void>;
  markQuizPromptSeen: () => Promise<void>;
  markQuizTaken: () => Promise<void>;

  // Utilities
  resetTutorials: () => Promise<void>;
  loadTutorialState: () => Promise<void>;
}

const STORAGE_KEY = '@weave_tutorial_state';

export const useTutorialStore = create<TutorialState>((set, get) => ({
  // Initial state
  hasCompletedOnboarding: false,
  hasAddedFirstFriend: false,
  hasSeenQuickWeaveIntro: false,
  hasPerformedQuickWeave: false,
  hasSeenIntentionIntro: false,
  hasSetIntention: false,
  hasSeenPlanIntro: false,
  hasCreatedPlan: false,
  hasSeenTodaysFocus: false,
  hasSeenSocialBattery: false,
  hasSeenInsightsTab: false,
  hasSeenQuizPrompt: false,
  hasTakenQuiz: false,

  // Helper to persist state
  persistState: async (updates: Partial<TutorialState>) => {
    try {
      const currentState = get();
      const newState = { ...currentState, ...updates };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      set(updates);
    } catch (error) {
      console.error('Failed to persist tutorial state:', error);
    }
  },

  completeOnboarding: async () => {
    const { persistState } = get();
    await persistState({ hasCompletedOnboarding: true });

    // Track event and set user property for reliable segmentation
    trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED);
    setUserProperties({ onboarding_completed: true });
  },

  markFirstFriendAdded: async () => {
    const { persistState } = get();
    await persistState({ hasAddedFirstFriend: true });
  },

  markQuickWeaveIntroSeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenQuickWeaveIntro: true });
  },

  markQuickWeavePerformed: async () => {
    const { persistState } = get();
    await persistState({ hasPerformedQuickWeave: true });
  },

  markIntentionIntroSeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenIntentionIntro: true });
  },

  markIntentionSet: async () => {
    const { persistState } = get();
    await persistState({ hasSetIntention: true });
  },

  markPlanIntroSeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenPlanIntro: true });
  },

  markPlanCreated: async () => {
    const { persistState } = get();
    await persistState({ hasCreatedPlan: true });
  },

  markTodaysFocusSeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenTodaysFocus: true });
  },

  markSocialBatterySeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenSocialBattery: true });
  },

  markInsightsTabSeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenInsightsTab: true });
  },

  markQuizPromptSeen: async () => {
    const { persistState } = get();
    await persistState({ hasSeenQuizPrompt: true });
  },

  markQuizTaken: async () => {
    const { persistState } = get();
    await persistState({ hasTakenQuiz: true });
  },

  resetTutorials: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({
        hasCompletedOnboarding: false,
        hasAddedFirstFriend: false,
        hasSeenQuickWeaveIntro: false,
        hasPerformedQuickWeave: false,
        hasSeenIntentionIntro: false,
        hasSetIntention: false,
        hasSeenPlanIntro: false,
        hasCreatedPlan: false,
        hasSeenTodaysFocus: false,
        hasSeenSocialBattery: false,
        hasSeenInsightsTab: false,
        hasSeenQuizPrompt: false,
        hasTakenQuiz: false,
      });
    } catch (error) {
      console.error('Failed to reset tutorial state:', error);
    }
  },

  loadTutorialState: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set(parsed);
      }
    } catch (error) {
      console.error('Failed to load tutorial state:', error);
    }
  },
}));
